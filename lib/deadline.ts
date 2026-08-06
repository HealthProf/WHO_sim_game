// HARD/SOFT/NONE deadline enforcement per simulation-docs/05-product-requirements.md
// §9. Runs opportunistically from every dashboard/display poll and from the
// daily Vercel cron. Deadline windows are compressed by
// sessionState.fastModeMultiplier (see simulation-docs/07-open-questions.md
// Q3/Q4 discussion — this app is being run as a ~60 minute compressed test
// session).

import { db } from "./db";
import { eventDispatches, events, decisions, gameSessions, sessionState, teams } from "./db/schema";
import { and, eq, isNull, lte, lt, or, inArray } from "drizzle-orm";
import { applyPassiveDrift } from "./model-engine";
import { closeExpiredSnapVotes } from "./snap-vote";
import { processBudgetCycleTimers } from "./budget-cycle";
import { checkSocialMilestones } from "./social-thresholds";
import { applyFastPathScore } from "./fast-path-scoring";
import { runAutoplayer } from "./autoplayer/run";
import { TICK_THROTTLE_SECONDS } from "./config";
import { computeDeadlineAt } from "./deadline-window";

export { computeDeadlineAt };

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
// Scoped per session (via sessionState.sessionId) so concurrent sessions
// tick independently — one session's throttle never blocks another's.
export async function processDeadlines(sessionId: string) {
  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  if (!gs || gs.simulationStatus !== "running") {
    return { remindersSent: 0, autoApplied: 0, skipped: "simulation not running" };
  }

  const cutoff = new Date(Date.now() - TICK_THROTTLE_SECONDS * 1000);
  const claimed = await db
    .update(sessionState)
    .set({ lastTickAt: new Date() })
    .where(
      and(
        eq(sessionState.sessionId, sessionId),
        or(isNull(sessionState.lastTickAt), lt(sessionState.lastTickAt, cutoff))
      )
    )
    .returning();
  if (claimed.length === 0) {
    return { remindersSent: 0, autoApplied: 0, skipped: "ticked recently" };
  }

  await applyPassiveDrift(sessionId, gs).catch((e) => console.error("[tick] applyPassiveDrift failed:", e));
  await closeExpiredSnapVotes(sessionId).catch((e) => console.error("[tick] closeExpiredSnapVotes failed:", e));
  await processBudgetCycleTimers(sessionId).catch((e) => console.error("[tick] processBudgetCycleTimers failed:", e));
  await checkSocialMilestones(sessionId).catch((e) => console.error("[tick] checkSocialMilestones failed:", e));
  await runAutoplayer(sessionId).catch((e) => console.error("[tick] runAutoplayer failed:", e));

  const now = new Date();
  let remindersSent = 0;
  let autoApplied = 0;

  const dueReminders = await db.query.eventDispatches.findMany({
    where: and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.status, "dispatched"), isNull(eventDispatches.reminderSentAt)),
  });
  const reminderEventIds = [...new Set(dueReminders.map((d) => d.eventId))];
  const reminderEvents =
    reminderEventIds.length > 0 ? await db.query.events.findMany({ where: (t, { inArray: ia }) => ia(t.id, reminderEventIds) }) : [];
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
    where: and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.status, "dispatched"), lte(eventDispatches.deadlineAt, now)),
  });

  // The session owner stands in as "who to attribute automatic instructor-
  // side actions to" (instructorActions.instructorUserId stays a non-null
  // users.id FK — see lib/consequences.ts) — replaces the old
  // `eq(users.role, "instructor")` lookup, which picked an arbitrary
  // instructor once multiple public accounts existed.
  const owningSession = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, sessionId) });

  const expiredDispatchIds = expiredCandidates.map((d) => d.id);
  const existingDecisionsForExpired =
    expiredDispatchIds.length > 0
      ? await db.query.decisions.findMany({ where: and(eq(decisions.sessionId, sessionId), inArray(decisions.eventDispatchId, expiredDispatchIds)) })
      : [];
  const expiredEventIds = [...new Set(expiredCandidates.map((d) => d.eventId))];
  const expiredEvents = expiredEventIds.length > 0 ? await db.query.events.findMany({ where: inArray(events.id, expiredEventIds) }) : [];
  const expiredTeamIds = [...new Set(expiredCandidates.map((d) => d.targetTeamId).filter((id): id is number => id != null))];
  const expiredTeams =
    expiredTeamIds.length > 0
      ? await db.query.teams.findMany({ where: and(eq(teams.sessionId, sessionId), inArray(teams.id, expiredTeamIds)) })
      : [];

  for (const dispatch of expiredCandidates) {
    if (!dispatch.deadlineAt || !dispatch.targetTeamId) continue;

    const existingDecision = existingDecisionsForExpired.find((d) => d.eventDispatchId === dispatch.id);
    if (existingDecision) continue; // team submitted in time; scoring inbox will handle it

    const event = expiredEvents.find((e) => e.id === dispatch.eventId);
    if (!event || !owningSession) continue;

    const [decision] = await db
      .insert(decisions)
      .values({
        sessionId,
        eventDispatchId: dispatch.id,
        teamId: dispatch.targetTeamId,
        submittedByUserId: null,
        actorKind: "system",
        structuredChoice: null,
        rationaleText: "(No submission received before deadline — fallback tier auto-applied.)",
      })
      .returning();

    const tier = event.noResponseFallbackTier;
    const region = expiredTeams.find((t) => t.id === dispatch.targetTeamId)?.regionId ?? null;
    if (region) {
      await applyFastPathScore({
        sessionId,
        decision,
        event,
        regionId: region,
        tier,
        overrideReason: "Auto-applied at deadline expiry: no submission received.",
        scoredByUserId: owningSession.ownerUserId,
      });
    }
    autoApplied++;
  }

  return { remindersSent, autoApplied };
}
