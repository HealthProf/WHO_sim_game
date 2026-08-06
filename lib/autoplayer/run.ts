// Hooked into lib/deadline.ts's processDeadlines(sessionId) tick — the
// existing "things that happen automatically while the sim is running"
// path (AGENTS.md is explicit new automatic mechanics belong there rather
// than a new polling path). Two responsibilities for a running demo
// session: dispatch the next core-path event once the narrative clock
// reaches it, and answer open dispatches for whichever regions the scripted
// autoplayer is currently driving.
import { db } from "../db";
import { gameSessions, sessionState, sessionRegionAutoplay, teams, eventDispatches, events, modelState, instructorActions, decisions, scores } from "../db/schema";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import { computeSimClock } from "../sim-clock";
import { canDispatch } from "../chain";
import { computeDeadlineAt } from "../deadline-window";
import { announceDispatch } from "../announcements";
import { submitDecision } from "../decisions";
import { applyFastPathScore, tierForStructuredChoice } from "../fast-path-scoring";
import { scriptedAutoplayer } from "./index";
import { AUTOPLAY_STRUGGLING_MISS_CHANCE } from "../config";
import type { RegionId } from "../regions";

// Deterministic per-dispatch pseudo-randomness (not Math.random(), which
// would re-roll every ~3s tick and never let a "the autoplayer will miss
// this deadline" outcome stick) — same dispatch id always maps to the same
// fraction, so a struggling region's miss/response timing is stable across
// ticks without needing to persist extra state.
function pseudoRandomFraction(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const DEFAULT_RESPONSE_WINDOW_MS = 90_000; // used for deadlineType NONE dispatches, which have no deadlineAt

async function autoDispatchNextCoreEvent(sessionId: string, gs: typeof sessionState.$inferSelect) {
  const clock = computeSimClock(gs);

  const alreadyDispatchedEventIds = new Set(
    (await db.query.eventDispatches.findMany({ where: eq(eventDispatches.sessionId, sessionId) })).map((d) => d.eventId)
  );

  const candidates = await db.query.events.findMany({
    where: eq(events.isCorePath, true),
    orderBy: asc(events.day),
  });
  const next = candidates.find((e) => e.day <= clock.gameDay && !alreadyDispatchedEventIds.has(e.id));
  if (!next) return;

  const chain = await canDispatch(sessionId, next.id);
  if (!chain.ok) return; // prerequisite not yet resolved — try again next tick

  const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });
  if (allTeams.length === 0) return;

  const dispatchedAt = new Date();
  const deadlineAt = await computeDeadlineAt(sessionId, next.id, dispatchedAt);

  await db.insert(eventDispatches).values(
    allTeams.map((t) => ({
      sessionId,
      eventId: next.id,
      targetTeamId: t.id,
      dispatchedAt,
      deadlineAt,
      status: "dispatched" as const,
      dispatchedByUserId: null,
    }))
  );

  const session = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, sessionId) });
  if (session) {
    await db.insert(instructorActions).values({
      sessionId,
      instructorUserId: session.ownerUserId,
      actionType: "demo_auto_dispatch",
      targetDesc: `${next.id} -> all teams (narrative day ${clock.gameDay})`,
    });
  }

  await announceDispatch({ sessionId, eventId: next.id, eventTitle: next.title, targetTeamIds: allTeams.map((t) => t.id) });
}

async function respondAsAutoplayer(sessionId: string, region: typeof sessionRegionAutoplay.$inferSelect, now: Date) {
  const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.regionId, region.regionId)) });
  if (!team) return;

  const openDispatches = await db.query.eventDispatches.findMany({
    where: and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.targetTeamId, team.id), eq(eventDispatches.status, "dispatched")),
  });

  for (const dispatch of openDispatches) {
    const windowMs = dispatch.deadlineAt ? dispatch.deadlineAt.getTime() - dispatch.dispatchedAt.getTime() : DEFAULT_RESPONSE_WINDOW_MS;
    const responseFraction = 0.3 + pseudoRandomFraction(dispatch.id) * 0.6; // respond somewhere in the 30%-90% mark
    const elapsedFraction = (now.getTime() - dispatch.dispatchedAt.getTime()) / Math.max(windowMs, 1);
    if (elapsedFraction < responseFraction) continue; // not yet — try again next tick

    if (region.profile === "struggling" && pseudoRandomFraction(dispatch.id * 7 + 1) < AUTOPLAY_STRUGGLING_MISS_CHANCE) {
      continue; // deliberately misses this one — the hard-deadline auto-fallback (lib/deadline.ts) handles it
    }

    const event = await db.query.events.findFirst({ where: eq(events.id, dispatch.eventId) });
    const state = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, region.regionId)) });
    if (!event || !state) continue;

    const decision = await scriptedAutoplayer.decideForRegion({
      sessionId,
      regionId: region.regionId as RegionId,
      event,
      modelState: state,
      profile: region.profile,
    });

    const result = await submitDecision({
      sessionId,
      teamId: team.id,
      eventDispatchId: dispatch.id,
      structuredChoice: decision.optionLabel,
      rationaleText: decision.rationaleText,
      resourceAllocationJson: decision.resourceAllocationJson,
      confidenceLevel: decision.confidenceLevel,
      actor: { kind: "autoplayer", userId: null },
    });
    if ("error" in result) continue;

    const session = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, sessionId) });
    if (!session) continue;

    await applyFastPathScore({
      sessionId,
      decision: result.decision,
      event,
      regionId: region.regionId,
      tier: decision.tier,
      overrideReason: `Autoplayer (${region.profile} profile): ${decision.rationale}`,
      scoredByUserId: session.ownerUserId,
    });
  }
}

// In demo mode there is no instructor scoring inbox for the region the
// owner is occupying — see build-plan §4.5 — so their own decisions get the
// same fast-path scoring the autoplayer's do. For a structured-option
// choice, the tier is that option's own suggestedTier (a real,
// deterministic read of what they picked). The four events with no
// structured options have no such basis; ADEQUATE is used as a neutral
// placeholder default rather than sampling one, since this is a real
// player's decision, not a scripted one — TODO(Tim): revisit once there's
// a better answer for scoring free-text/allocation decisions without a
// human reviewer.
async function autoScoreOwnerDecisions(sessionId: string, ownerUserId: number) {
  const respondedDispatches = await db.query.eventDispatches.findMany({
    where: and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.status, "responded")),
  });
  for (const dispatch of respondedDispatches) {
    const latestDecision = await db.query.decisions.findFirst({
      where: and(eq(decisions.sessionId, sessionId), eq(decisions.eventDispatchId, dispatch.id)),
      orderBy: desc(decisions.submittedAt),
    });
    if (!latestDecision || latestDecision.actorKind !== "owner") continue;

    const alreadyScored = await db.query.scores.findFirst({ where: eq(scores.decisionId, latestDecision.id) });
    if (alreadyScored) continue;

    const event = await db.query.events.findFirst({ where: eq(events.id, dispatch.eventId) });
    if (!event) continue;

    const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.id, latestDecision.teamId)) });
    if (!team) continue;

    const tier = tierForStructuredChoice(event, latestDecision.structuredChoice) ?? "ADEQUATE";

    await applyFastPathScore({
      sessionId,
      decision: latestDecision,
      event,
      regionId: team.regionId,
      tier,
      overrideReason: "Demo mode: auto-scored (no separate instructor to review it).",
      scoredByUserId: ownerUserId,
    });
  }
}

export async function runAutoplayer(sessionId: string) {
  const session = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, sessionId) });
  if (!session || session.mode !== "demo") return;

  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  if (!gs || gs.simulationStatus !== "running") return;

  await autoDispatchNextCoreEvent(sessionId, gs).catch((e) => console.error("[autoplayer] auto-dispatch failed:", e));

  const autoplayRegions = await db.query.sessionRegionAutoplay.findMany({
    where: and(eq(sessionRegionAutoplay.sessionId, sessionId), eq(sessionRegionAutoplay.enabled, true), ne(sessionRegionAutoplay.regionId, session.demoActiveRegionId ?? "")),
  });

  const now = new Date();
  for (const region of autoplayRegions) {
    await respondAsAutoplayer(sessionId, region, now).catch((e) => console.error(`[autoplayer] ${region.regionId} failed:`, e));
  }

  await autoScoreOwnerDecisions(sessionId, session.ownerUserId).catch((e) => console.error("[autoplayer] autoScoreOwnerDecisions failed:", e));
}

