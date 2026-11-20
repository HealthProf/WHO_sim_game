// Class-session autopilot (Release 1, off by default). When the facilitator
// turns it on, each tick fires the "Next up" recommendation (lib/pacing.ts)
// once its scheduled slot arrives, through the same dispatch path as the
// manual button (lib/dispatch.ts). It only ever fires *required* events;
// optional events stay a facilitator decision.
//
// Hooked into lib/deadline.ts's processDeadlines tick, which is already
// throttled per session by an atomic claim, so concurrent pollers can't
// double-fire. The pending check below is a second guard: an event that
// already has any dispatch row is never fired again.
import { db } from "./db";
import { eventDispatches, gameSessions, sessionState } from "./db/schema";
import { eq } from "drizzle-orm";
import { computeAllChainStatus } from "./chain";
import { computeEventTargetHints } from "./event-targeting";
import { computePacing } from "./pacing";
import { dispatchEventToRegions } from "./dispatch";

// Hard stop so an unattended autopilot can't pile events onto teams while
// the facilitator isn't scoring (the soft limit in lib/pacing.ts is 2).
const AUTOPILOT_HARD_MAX_OPEN_PER_TEAM = 3;

export async function runAutopilot(sessionId: string): Promise<string | null> {
  const session = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, sessionId) });
  if (!session) return null;
  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  if (!gs || !gs.autopilotEnabled || gs.simulationStatus !== "running") return null;
  // Class sessions, and solo games where the player is the facilitator (a
  // computer facilitator already fires events itself).
  if (session.mode === "demo" && gs.computerFacilitator) return null;

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
  });

  const next = pacing.next;
  if (!next || next.dueInMinutes == null || next.dueInMinutes > 0) return null;
  if (pacing.maxOpenPerTeam >= AUTOPILOT_HARD_MAX_OPEN_PER_TEAM) return null;
  if (dispatches.some((d) => d.eventId === next.eventId)) return null;

  const result = await dispatchEventToRegions({
    sessionId,
    eventId: next.eventId,
    targetRegionIds: next.targetRegions,
    dispatchedByUserId: null,
    actionUserId: session.ownerUserId,
    actionType: "autopilot_dispatch",
    reason: "Autopilot: required event reached its scheduled slot",
  });
  return result.ok ? next.eventId : null;
}

