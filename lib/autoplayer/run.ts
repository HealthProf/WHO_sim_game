// Hooked into lib/deadline.ts's processDeadlines(sessionId) tick — the
// existing "things that happen automatically while the sim is running"
// path (AGENTS.md is explicit new automatic mechanics belong there rather
// than a new polling path). For a running session it: runs the computer
// facilitator in solo games that use one (lib/computer-facilitator.ts),
// answers open dispatches for every computer-run region (solo play, or class
// regions marked "computer" on the setup page), and lets those regions take
// part in the economy (./economy.ts).
import { db } from "../db";
import { gameSessions, sessionState, sessionRegionAutoplay, teams, eventDispatches, events, modelState } from "../db/schema";
import { and, eq, ne } from "drizzle-orm";
import { submitDecision } from "../decisions";
import { applyFastPathScore } from "../fast-path-scoring";
import { runComputerFacilitator, scoreHumanSubmissions } from "../computer-facilitator";
import { computerEconomyTurn } from "./economy";
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

export async function runAutoplayer(sessionId: string) {
  const session = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, sessionId) });
  if (!session) return;

  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  if (!gs || gs.simulationStatus !== "running") return;

  // Solo play with the computer as facilitator (the player chose a region,
  // or an older solo game with no role chosen): it fires events, scores the
  // player, and handles the economy (lib/computer-facilitator.ts).
  if (session.mode === "demo" && gs.computerFacilitator) {
    await runComputerFacilitator(session, gs).catch((e) => console.error("[autoplayer] computer facilitator failed:", e));
  }

  // Computer-run regions: every region in solo play except the one the owner
  // occupies; in class sessions, only regions the facilitator marked
  // "computer" on the setup page (Release 3).
  const autoplayRegions = await db.query.sessionRegionAutoplay.findMany({
    where: and(
      eq(sessionRegionAutoplay.sessionId, sessionId),
      eq(sessionRegionAutoplay.enabled, true),
      ne(sessionRegionAutoplay.regionId, session.demoActiveRegionId ?? "")
    ),
  });

  const now = new Date();
  for (const region of autoplayRegions) {
    await respondAsAutoplayer(sessionId, region, now).catch((e) => console.error(`[autoplayer] ${region.regionId} failed:`, e));
    await computerEconomyTurn(sessionId, region).catch((e) => console.error(`[autoplayer] ${region.regionId} economy failed:`, e));
  }

  // Solo play where the owner is the facilitator but has stepped into a
  // region: there's nobody else to score that region's decisions, so they're
  // scored with the rule-based provisional grade, as before.
  if (session.mode === "demo" && !gs.computerFacilitator && session.demoActiveRegionId) {
    await scoreHumanSubmissions(session).catch((e) => console.error("[autoplayer] owner scoring failed:", e));
  }
}
