// HARD/SOFT/NONE deadline enforcement per simulation-docs/05-product-requirements.md
// §9. Runs from the Vercel Cron route so it works whether or not a human is
// watching. Deadline windows are compressed by global_state.fastModeMultiplier
// (see simulation-docs/07-open-questions.md Q3/Q4 discussion — this app is
// being run as a ~60 minute compressed test session).

import { db } from "./db";
import { eventDispatches, events, decisions, scores, users, globalState } from "./db/schema";
import { and, eq, isNull, lte } from "drizzle-orm";
import { computeCompositePct, defaultScoresForTier } from "./scoring";
import { applyModelDelta, applyPassiveDrift } from "./model-engine";
import { pushConsequence } from "./consequences";
import { closeExpiredSnapVotes } from "./snap-vote";

export async function computeDeadlineAt(eventId: string, dispatchedAt: Date): Promise<Date | null> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event || event.deadlineType === "NONE" || event.deadlineWindowHours == null) return null;

  const gs = await db.query.globalState.findFirst({ where: eq(globalState.id, 1) });
  const multiplier = gs?.fastModeMultiplier ?? 1;
  const windowMinutes = event.deadlineWindowHours * 60 * multiplier;
  return new Date(dispatchedAt.getTime() + windowMinutes * 60_000);
}

export async function computeReminderAt(eventId: string, dispatchedAt: Date): Promise<Date | null> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event || event.deadlineType !== "SOFT" || event.reminderAtHours == null) return null;

  const gs = await db.query.globalState.findFirst({ where: eq(globalState.id, 1) });
  const multiplier = gs?.fastModeMultiplier ?? 1;
  const reminderMinutes = event.reminderAtHours * 60 * multiplier;
  return new Date(dispatchedAt.getTime() + reminderMinutes * 60_000);
}

// Called by the cron route on every tick. Marks SOFT reminders sent and
// auto-applies each event's specified no-response fallback tier to any
// dispatch whose deadline has passed with no submission.
export async function processDeadlines() {
  const gs = await db.query.globalState.findFirst({ where: eq(globalState.id, 1) });
  if (!gs || gs.simulationStatus !== "running") {
    return { remindersSent: 0, autoApplied: 0, skipped: "simulation not running" };
  }

  await applyPassiveDrift(gs).catch(() => {});
  await closeExpiredSnapVotes().catch(() => {});

  const now = new Date();
  let remindersSent = 0;
  let autoApplied = 0;

  const dueReminders = await db.query.eventDispatches.findMany({
    where: and(eq(eventDispatches.status, "dispatched"), isNull(eventDispatches.reminderSentAt)),
  });
  for (const d of dueReminders) {
    const reminderAt = await computeReminderAt(d.eventId, d.dispatchedAt);
    if (reminderAt && reminderAt <= now) {
      await db.update(eventDispatches).set({ reminderSentAt: now }).where(eq(eventDispatches.id, d.id));
      remindersSent++;
    }
  }

  const expiredCandidates = await db.query.eventDispatches.findMany({
    where: and(eq(eventDispatches.status, "dispatched"), lte(eventDispatches.deadlineAt, now)),
  });

  const systemUser = await db.query.users.findFirst({ where: eq(users.role, "instructor") });

  for (const dispatch of expiredCandidates) {
    if (!dispatch.deadlineAt || !dispatch.targetTeamId) continue;

    const existingDecision = await db.query.decisions.findFirst({
      where: eq(decisions.eventDispatchId, dispatch.id),
    });
    if (existingDecision) continue; // team submitted in time; scoring inbox will handle it

    const event = await db.query.events.findFirst({ where: eq(events.id, dispatch.eventId) });
    if (!event || !systemUser) continue;

    const [decision] = await db
      .insert(decisions)
      .values({
        eventDispatchId: dispatch.id,
        teamId: dispatch.targetTeamId,
        submittedByUserId: systemUser.id,
        structuredChoice: null,
        rationaleText: "(No submission received before deadline — fallback tier auto-applied.)",
      })
      .returning();

    const tier = event.noResponseFallbackTier;
    const dims = defaultScoresForTier(tier);
    const compositePct = computeCompositePct(dims);

    await db.insert(scores).values({
      decisionId: decision.id,
      evidenceScore: dims.evidenceScore,
      politicalScore: dims.politicalScore,
      equityScore: dims.equityScore,
      rawCompositePct: compositePct,
      calibrationAdjustment: 0,
      compositePct,
      tier,
      suggestedTier: tier,
      fastPathed: true,
      overrideReason: "Auto-applied at deadline expiry: no submission received.",
      scoredByUserId: systemUser.id,
    });

    const deltas = (event.modelDeltaJson as Record<string, unknown[]>)?.[tier] ?? [];
    const region = await regionForTeam(dispatch.targetTeamId);
    if (region) {
      await applyModelDelta({
        deltas: deltas as never,
        submittingRegionId: region,
        reason: `${event.id} deadline expired, no response: ${tier} auto-applied`,
      });
      await pushConsequence({
        event,
        dispatchId: dispatch.id,
        teamId: dispatch.targetTeamId,
        regionId: region,
        tier,
        deltas: deltas as never,
        actorUserId: systemUser.id,
      });
    }

    await db.update(eventDispatches).set({ status: "scored" }).where(eq(eventDispatches.id, dispatch.id));
    autoApplied++;
  }

  return { remindersSent, autoApplied };
}

async function regionForTeam(teamId: number): Promise<string | null> {
  const { teams } = await import("./db/schema");
  const team = await db.query.teams.findFirst({ where: eq(teams.id, teamId) });
  return team?.regionId ?? null;
}
