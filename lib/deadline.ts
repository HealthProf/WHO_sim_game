// HARD/SOFT/NONE deadline enforcement per simulation-docs/05-product-requirements.md
// §9. Runs from the Vercel Cron route so it works whether or not a human is
// watching. Deadline windows are compressed by global_state.fastModeMultiplier
// (see simulation-docs/07-open-questions.md Q3/Q4 discussion — this app is
// being run as a ~60 minute compressed test session).

import { db } from "./db";
import { eventDispatches, events, decisions, scores, users, globalState, modelState } from "./db/schema";
import { and, eq, isNull, lte, lt, or, inArray } from "drizzle-orm";
import { computeCompositePct, defaultScoresForTier } from "./scoring";
import { applyModelDelta, applyOptimalShadowDelta, applyPassiveDrift } from "./model-engine";
import { pushConsequence } from "./consequences";
import { closeExpiredSnapVotes } from "./snap-vote";
import { maybeAnnounceResolution, announceDecisionRevealed } from "./announcements";
import { processBudgetCycleTimers } from "./budget-cycle";
import { checkSocialMilestones } from "./social-thresholds";
import { maybeStakeholderReact } from "./stakeholders";
import { TICK_THROTTLE_SECONDS } from "./config";

export async function computeDeadlineAt(eventId: string, dispatchedAt: Date): Promise<Date | null> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event || event.deadlineType === "NONE" || event.deadlineWindowHours == null) return null;

  const gs = await db.query.globalState.findFirst({ where: eq(globalState.id, 1) });
  const multiplier = gs?.fastModeMultiplier ?? 1;
  const intensity = gs?.intensityMultiplier && gs.intensityMultiplier > 0 ? gs.intensityMultiplier : 1.0;
  const windowMinutes = (event.deadlineWindowHours * 60 * multiplier) / intensity;
  return new Date(dispatchedAt.getTime() + windowMinutes * 60_000);
}

// Called opportunistically by every dashboard/display/control-page poll
// (see the note in app/api/dashboard/route.ts) rather than solely by a
// cron route, so this same function also carries every other "opportunistic
// side effect while the sim is running" subsystem — passive drift, snap
// vote expiry, budget cycle timers, and social milestones — alongside its
// own deadline-reminder/auto-fallback work below.
//
// Up to ~8 clients can poll within the same second, so the whole tick is
// claimed first via a single atomic conditional UPDATE (lastTickAt, throttled
// to once per TICK_THROTTLE_SECONDS) — callers that lose the race skip
// straight to a no-op return rather than re-running every subsystem's own
// queries redundantly. This is a throttle, not a lock: it bounds how often
// the work runs, it doesn't serialize concurrent callers against each other.
export async function processDeadlines() {
  const gs = await db.query.globalState.findFirst({ where: eq(globalState.id, 1) });
  if (!gs || gs.simulationStatus !== "running") {
    return { remindersSent: 0, autoApplied: 0, skipped: "simulation not running" };
  }

  const cutoff = new Date(Date.now() - TICK_THROTTLE_SECONDS * 1000);
  const claimed = await db
    .update(globalState)
    .set({ lastTickAt: new Date() })
    .where(and(eq(globalState.id, 1), or(isNull(globalState.lastTickAt), lt(globalState.lastTickAt, cutoff))))
    .returning();
  if (claimed.length === 0) {
    return { remindersSent: 0, autoApplied: 0, skipped: "ticked recently" };
  }

  await applyPassiveDrift(gs).catch((e) => console.error("[tick] applyPassiveDrift failed:", e));
  await closeExpiredSnapVotes().catch((e) => console.error("[tick] closeExpiredSnapVotes failed:", e));
  await processBudgetCycleTimers().catch((e) => console.error("[tick] processBudgetCycleTimers failed:", e));
  await checkSocialMilestones().catch((e) => console.error("[tick] checkSocialMilestones failed:", e));

  const now = new Date();
  let remindersSent = 0;
  let autoApplied = 0;

  const dueReminders = await db.query.eventDispatches.findMany({
    where: and(eq(eventDispatches.status, "dispatched"), isNull(eventDispatches.reminderSentAt)),
  });
  const reminderEventIds = [...new Set(dueReminders.map((d) => d.eventId))];
  const reminderEvents =
    reminderEventIds.length > 0 ? await db.query.events.findMany({ where: (t, { inArray }) => inArray(t.id, reminderEventIds) }) : [];
  const multiplier = gs.fastModeMultiplier ?? 1;
  const intensity = gs.intensityMultiplier && gs.intensityMultiplier > 0 ? gs.intensityMultiplier : 1.0;
  const remindedDispatchIds: number[] = [];
  for (const d of dueReminders) {
    const event = reminderEvents.find((e) => e.id === d.eventId);
    if (!event || event.deadlineType !== "SOFT" || event.reminderAtHours == null) continue;
    const reminderMinutes = (event.reminderAtHours * 60 * multiplier) / intensity;
    const reminderAt = new Date(d.dispatchedAt.getTime() + reminderMinutes * 60_000);
    if (reminderAt <= now) remindedDispatchIds.push(d.id);
  }
  if (remindedDispatchIds.length > 0) {
    await db.update(eventDispatches).set({ reminderSentAt: now }).where(inArray(eventDispatches.id, remindedDispatchIds));
    remindersSent = remindedDispatchIds.length;
  }

  const expiredCandidates = await db.query.eventDispatches.findMany({
    where: and(eq(eventDispatches.status, "dispatched"), lte(eventDispatches.deadlineAt, now)),
  });

  const systemUser = await db.query.users.findFirst({ where: eq(users.role, "instructor") });

  const expiredDispatchIds = expiredCandidates.map((d) => d.id);
  const existingDecisionsForExpired =
    expiredDispatchIds.length > 0 ? await db.query.decisions.findMany({ where: inArray(decisions.eventDispatchId, expiredDispatchIds) }) : [];
  const expiredEventIds = [...new Set(expiredCandidates.map((d) => d.eventId))];
  const expiredEvents = expiredEventIds.length > 0 ? await db.query.events.findMany({ where: inArray(events.id, expiredEventIds) }) : [];
  const expiredTeamIds = [...new Set(expiredCandidates.map((d) => d.targetTeamId).filter((id): id is number => id != null))];
  const expiredTeams = expiredTeamIds.length > 0 ? await db.query.teams.findMany({ where: (t, { inArray: ia }) => ia(t.id, expiredTeamIds) }) : [];

  for (const dispatch of expiredCandidates) {
    if (!dispatch.deadlineAt || !dispatch.targetTeamId) continue;

    const existingDecision = existingDecisionsForExpired.find((d) => d.eventDispatchId === dispatch.id);
    if (existingDecision) continue; // team submitted in time; scoring inbox will handle it

    const event = expiredEvents.find((e) => e.id === dispatch.eventId);
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

    const deltaJson = (event.modelDeltaJson as Record<string, unknown[]>) ?? {};
    const deltas = deltaJson[tier] ?? [];
    const region = expiredTeams.find((t) => t.id === dispatch.targetTeamId)?.regionId ?? null;
    if (region) {
      await applyModelDelta({
        deltas: deltas as never,
        submittingRegionId: region,
        reason: `${event.id} deadline expired, no response: ${tier} auto-applied`,
      });
      await applyOptimalShadowDelta((deltaJson.OPTIMAL as never) ?? [], region);
      const afterState = await db.query.modelState.findFirst({ where: eq(modelState.regionId, region) });
      await pushConsequence({
        event,
        dispatchId: dispatch.id,
        teamId: dispatch.targetTeamId,
        regionId: region,
        tier,
        deltas: deltas as never,
        actorUserId: systemUser.id,
        afterState: afterState ?? undefined,
      });
      await announceDecisionRevealed({
        eventId: event.id,
        eventTitle: event.title,
        regionId: region,
        submittingTeamId: dispatch.targetTeamId,
        structuredChoice: null,
        tier,
      });
      await maybeStakeholderReact(dispatch.targetTeamId, tier);
    }

    await db.update(eventDispatches).set({ status: "scored" }).where(eq(eventDispatches.id, dispatch.id));
    await maybeAnnounceResolution(event.id);
    autoApplied++;
  }

  return { remindersSent, autoApplied };
}
