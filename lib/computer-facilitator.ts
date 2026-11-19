// The computer facilitator (Release 3): runs the facilitator side of a solo
// game when the player is playing a single region (or in an older solo game
// where no role was chosen). Called from the per-session throttled tick
// (lib/autoplayer/run.ts via lib/deadline.ts), so it never needs its own
// polling path and concurrent pollers can't double-act. Everything it does
// goes through the same functions a human facilitator's buttons use.
//
// What it does each tick:
// 1. Fires events from the pacing recommender (lib/pacing.ts): every required
//    event at its scheduled slot, plus, for variety, some optional events.
//    Which optional events a given game gets is decided per game
//    (OPTIONAL_EVENT_CHANCE, stable per session+event), and they're only
//    fired when the recommender says there's slack.
// 2. Scores the human player's submissions with the rule-based provisional
//    grade (lib/auto-grade.ts) after a short "reading" delay. It reviews
//    everything, including items that would need a human's review.
// 3. Approves WHO HQ purchase requests after the 30-second heads-up window.
// 4. Contributes WHO HQ money to emergency funding requests and closes them.
// 5. Ends the game once the story is over and nothing is left open.
import { db } from "./db";
import { emergencyFundingRequests, eventDispatches, events, gameSessions, marketRequests, sessionState } from "./db/schema";
import { and, eq } from "drizzle-orm";
import { computeAllChainStatus } from "./chain";
import { computeEventTargetHints } from "./event-targeting";
import { computePacing } from "./pacing";
import { dispatchEventToRegions } from "./dispatch";
import { pendingSubmissions, scoreDecision } from "./score-decision";
import { closeEmergencyRequest, contributeToRequest, resolveMarketRequest } from "./facilitator-actions";
import { stableFraction } from "./autoplayer/economy";
import { computeGameDaysElapsed, computeRealElapsedMs } from "./sim-clock";
import { captureFinalSnapshot } from "./session-snapshot";
import { logSessionEvent } from "./session-events";

export const OPTIONAL_EVENT_CHANCE = 0.4;
const HARD_MAX_OPEN_PER_TEAM = 3;
const SCORE_DELAY_SECONDS = 20;
const MARKET_HEADS_UP_SECONDS = 30;
const FUNDING_CONTRIBUTE_AFTER_SECONDS = 30;
const FUNDING_CLOSE_AFTER_SECONDS = 120;
// WHO HQ gives between these shares of the amount requested, varying per
// request, capped by what it has left.
const WHO_HQ_SHARE_MIN = 0.3;
const WHO_HQ_SHARE_MAX = 0.6;

type Session = typeof gameSessions.$inferSelect;
type State = typeof sessionState.$inferSelect;

export async function runComputerFacilitator(session: Session, gs: State, now: Date = new Date()): Promise<void> {
  const sessionId = session.id;
  await fireEvents(sessionId, session, gs, now).catch((e) => console.error("[computer-facilitator] fire failed:", e));
  await scoreHumanSubmissions(session, now).catch((e) => console.error("[computer-facilitator] score failed:", e));
  await handleMarket(sessionId, session, now).catch((e) => console.error("[computer-facilitator] market failed:", e));
  await handleFunding(sessionId, session, gs, now).catch((e) => console.error("[computer-facilitator] funding failed:", e));
  await maybeEndGame(sessionId, session, gs, now).catch((e) => console.error("[computer-facilitator] end failed:", e));
}

async function fireEvents(sessionId: string, session: Session, gs: State, now: Date) {
  const allEvents = await db.query.events.findMany();
  const dispatches = await db.query.eventDispatches.findMany({ where: eq(eventDispatches.sessionId, sessionId) });
  const chainStatus = await computeAllChainStatus(sessionId, allEvents.map((e) => e.id));
  const targetHints = await computeEventTargetHints(sessionId);
  const pacing = computePacing({
    events: allEvents.map((e) => ({
      id: e.id,
      title: e.title,
      day: e.day,
      isCorePath: e.isCorePath,
      suggestedTargetRegions: (e.suggestedTargetRegions as string[] | null) ?? null,
    })),
    dispatches,
    chainStatus,
    targetHints,
    clock: gs,
    now: now.getTime(),
    researchReady: gs.rdMilestone >= 3,
  });
  if (pacing.maxOpenPerTeam >= HARD_MAX_OPEN_PER_TEAM) return;

  const fire = async (eventId: string, targetRegions: string[] | null, reason: string) => {
    if (dispatches.some((d) => d.eventId === eventId)) return false;
    const r = await dispatchEventToRegions({
      sessionId,
      eventId,
      targetRegionIds: targetRegions,
      dispatchedByUserId: null,
      actionUserId: session.ownerUserId,
      actionType: "computer_facilitator_dispatch",
      reason,
    });
    return r.ok;
  };

  if (pacing.next && pacing.next.dueInMinutes != null && pacing.next.dueInMinutes <= 0) {
    await fire(pacing.next.eventId, pacing.next.targetRegions, "Computer facilitator: required event reached its slot");
    return; // one event per tick keeps releases spaced out
  }
  // Optional events only when the recommender reports slack, and only the
  // ones this particular game "drew".
  const optional = pacing.optional.find((o) => stableFraction(`${sessionId}:${o.eventId}:optional`) < OPTIONAL_EVENT_CHANCE);
  if (optional) await fire(optional.eventId, optional.targetRegions, `Computer facilitator: optional event (${optional.reason})`);
}

// Scores the human player's latest submissions with the rule-based
// provisional grade after a short delay. Also used when a solo facilitator
// steps into a region (lib/autoplayer/run.ts), since nobody else can score it.
export async function scoreHumanSubmissions(session: Session, now: Date = new Date()) {
  const sessionId = session.id;
  const due = (await pendingSubmissions(sessionId)).filter(
    (d) => (d.actorKind === "owner" || d.actorKind === "team") && now.getTime() - d.submittedAt.getTime() >= SCORE_DELAY_SECONDS * 1000
  );
  for (const d of due) {
    try {
      await scoreDecision(
        sessionId,
        { decisionId: d.id, acceptProvisional: true, confirmReview: true, overrideReason: "Scored by the computer facilitator (rule-based grade)" },
        session.ownerUserId
      );
    } catch {
      // Already scored or superseded in the meantime.
    }
  }
}

async function handleMarket(sessionId: string, session: Session, now: Date) {
  const pending = await db.query.marketRequests.findMany({
    where: and(eq(marketRequests.sessionId, sessionId), eq(marketRequests.status, "pending")),
  });
  for (const r of pending) {
    if (now.getTime() - r.createdAt.getTime() < MARKET_HEADS_UP_SECONDS * 1000) continue;
    await resolveMarketRequest(sessionId, r.id, "approve", session.ownerUserId);
  }
}

async function handleFunding(sessionId: string, session: Session, gs: State, now: Date) {
  const open = await db.query.emergencyFundingRequests.findMany({
    where: and(eq(emergencyFundingRequests.sessionId, sessionId), eq(emergencyFundingRequests.status, "open")),
  });
  for (const r of open) {
    const age = now.getTime() - r.createdAt.getTime();
    if (age >= FUNDING_CONTRIBUTE_AFTER_SECONDS * 1000) {
      const share = WHO_HQ_SHARE_MIN + stableFraction(`${sessionId}:${r.id}:whohq`) * (WHO_HQ_SHARE_MAX - WHO_HQ_SHARE_MIN);
      const amount = Math.min(Math.round(r.amountRequested * share), gs.whoHqFund);
      // No-op if WHO HQ already contributed (unique per party).
      if (amount > 0) await contributeToRequest(sessionId, r.id, amount, { whoHq: true });
    }
    if (age >= FUNDING_CLOSE_AFTER_SECONDS * 1000) await closeEmergencyRequest(sessionId, r.id, session.ownerUserId);
  }
}

async function maybeEndGame(sessionId: string, session: Session, gs: State, now: Date) {
  if (gs.simulationStatus !== "running" || !gs.simulationStartedAt) return;
  const total = gs.totalGameDays > 0 ? gs.totalGameDays : 90;
  if (computeGameDaysElapsed(gs, computeRealElapsedMs(gs, now.getTime())) < total) return;
  const dispatches = await db.query.eventDispatches.findMany({ where: eq(eventDispatches.sessionId, sessionId) });
  // Nothing still awaiting an answer or a grade...
  if (dispatches.some((d) => d.status === "dispatched" || d.status === "responded")) return;
  // ...and every required event has actually been released, even if the
  // story clock ran out first (prerequisite chains can push the last ones late).
  const fired = new Set(dispatches.map((d) => d.eventId));
  const required = await db.query.events.findMany({ where: eq(events.isCorePath, true) });
  if (required.some((e) => !fired.has(e.id))) return;
  const ended = await db
    .update(sessionState)
    .set({ simulationStatus: "completed", pausedAt: now, updatedAt: now })
    .where(and(eq(sessionState.sessionId, sessionId), eq(sessionState.simulationStatus, "running")))
    .returning();
  if (ended.length === 0) return;
  await logSessionEvent({ sessionId, kind: "completed", mode: session.mode, detail: "ended by computer facilitator" });
  await captureFinalSnapshot(sessionId, "completed");
}
