import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionState, modelState, teamNotifications } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { requireActor } from "@/lib/session-context";
import { computeGlobalRt } from "@/lib/model-engine";
import { processDeadlines } from "@/lib/deadline";
import { getTeamAnnouncements, getActiveGlobalAnnouncement } from "@/lib/announcements";
import { projectForward } from "@/lib/projection";
import { computeSimClock } from "@/lib/sim-clock";
import { computeFinalResults } from "@/lib/final-results";
import { POLL_BACKOFF_MS } from "@/lib/config";
import { getCheatDisplayState, getRevertOverridesForSession } from "@/lib/cheat-engine";

// Polled every ~15s by team dashboards (see 07-open-questions.md Q4). Returns
// the shared Global Situation Summary for every region, plus the requesting
// team's own private resource/tension/trust ledger layered on top — never the
// other teams' private fields (04-regions.md's data-access-layer note).
//
// Also opportunistically runs deadline enforcement on every poll (see
// lib/deadline.ts) instead of relying solely on Vercel Cron — Hobby-tier
// Vercel projects only allow daily cron schedules, which is too coarse for a
// compressed ~60 minute session, so piggybacking on the polling traffic that
// dashboards/the projector display already generate every ~10-15s covers the
// same need without requiring a paid plan.
//
// ?since=<stateVersion> (Phase 5 poll backoff): the tick still has to run
// (it's the only thing that might change anything), but once sessionState's
// stateVersion after the tick matches what the client already has, the rest
// of this handler's queries are skipped entirely and a small
// { unchanged: true, nextPollMs } response is returned instead — see
// lib/state-version.ts for which mutations bump it.
export async function GET(req: NextRequest) {
  const { actor, error } = await requireActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  await processDeadlines(sessionId).catch(() => {});

  const since = req.nextUrl.searchParams.get("since");
  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  if (since != null && gs && String(gs.stateVersion) === since) {
    return NextResponse.json({ unchanged: true, nextPollMs: POLL_BACKOFF_MS, stateVersion: gs.stateVersion });
  }

  const allRegions = await db.query.regions.findMany();
  const allModelState = await db.query.modelState.findMany({ where: eq(modelState.sessionId, sessionId) });
  const globalRt = await computeGlobalRt(sessionId);

  // Cheat code #5's "revert to zero" — a purely cosmetic taper applied here,
  // never to the underlying model_state row (see lib/cheat-engine.ts).
  // Fail-safe: this whole endpoint is on the critical path for every screen
  // in the game, so a cheat-code subsystem problem (e.g. a database that
  // hasn't been migrated with the cheat_code_* tables yet) must never take
  // the rest of the dashboard down with it.
  const gameDaysPerRealMinute = gs?.gameDaysPerRealMinute && gs.gameDaysPerRealMinute > 0 ? gs.gameDaysPerRealMinute : 1.5;
  const revertOverrides = await getRevertOverridesForSession(sessionId, gameDaysPerRealMinute).catch((e) => {
    console.error("[dashboard] getRevertOverridesForSession failed:", e);
    return {} as Record<string, { confirmedCases: number; deaths: number }>;
  });

  const sharedSummary = allRegions.map((r) => {
    const s = allModelState.find((m) => m.regionId === r.id)!;
    const override = revertOverrides[r.id];
    return {
      regionId: r.id,
      fullName: r.fullName,
      confirmedCases: override ? override.confirmedCases : s.confirmedCases,
      estimatedTrueCasesLow: s.estimatedTrueCasesLow,
      estimatedTrueCasesHigh: s.estimatedTrueCasesHigh,
      deaths: override ? override.deaths : s.deaths,
      rt: s.rt,
      hospitalCapacityPct: s.hospitalCapacityPct,
      surveillanceIndex: s.surveillanceIndex,
    };
  });

  let ownRegion = null;
  let notifications: { id: number; kind: string; message: string; createdAt: Date }[] = [];
  let announcements: Awaited<ReturnType<typeof getTeamAnnouncements>> = [];
  if (actor!.role === "student" && actor!.regionId) {
    const s = allModelState.find((m) => m.regionId === actor!.regionId);
    const r = allRegions.find((r) => r.id === actor!.regionId);
    if (s && r) {
      const override = revertOverrides[actor!.regionId];
      ownRegion = {
        ...s,
        confirmedCases: override ? override.confirmedCases : s.confirmedCases,
        deaths: override ? override.deaths : s.deaths,
        profileMarkdown: r.profileMarkdown,
        roleTitle: r.roleTitle,
        hqLocation: r.hqLocation,
        projection: projectForward(s),
      };
    }
    if (actor!.teamId) {
      notifications = await db.query.teamNotifications.findMany({
        where: and(eq(teamNotifications.sessionId, sessionId), eq(teamNotifications.teamId, actor!.teamId)),
        orderBy: [desc(teamNotifications.createdAt)],
        limit: 8,
      });
      announcements = await getTeamAnnouncements(sessionId, actor!.teamId);
    }
  }

  // Global average social metrics (item 8) — an aggregate, not a per-region
  // breakdown, so it's safe to surface on shared/public views the same way
  // globalRt already is, without exposing any one region's private ledger.
  const avgPublicTrust = allModelState.length ? Math.round(allModelState.reduce((s, m) => s + m.publicTrustIndex, 0) / allModelState.length) : 0;
  const avgHappiness = allModelState.length ? Math.round(allModelState.reduce((s, m) => s + m.populationHappinessIndex, 0) / allModelState.length) : 0;

  // Item 14's "counterfactual as a live ghost" — a deliberately blurred
  // glimpse of the optimal-shadow comparison (see lib/final-results.ts),
  // surfaced only once the session is mostly over. The point is motivational
  // pressure, not information: the exact number stays legible-but-blurred
  // (never a range, never rounded away) so it reads as "the real number
  // exists and it's bad" rather than a vague hint, with the full breakdown
  // reserved for the actual debrief.
  let ghostPreview: { worldDeathsPrevented: number; worldInfectionsPrevented: number } | null = null;
  if (gs && gs.simulationStatus === "running") {
    const clock = computeSimClock(gs);
    if (clock.gameDay / clock.totalGameDays >= 0.7) {
      const finalResults = await computeFinalResults(sessionId);
      ghostPreview = { worldDeathsPrevented: finalResults.totalDeathsPrevented, worldInfectionsPrevented: finalResults.totalInfectionsPrevented };
    }
  }

  const cheat = await getCheatDisplayState(sessionId).catch((e) => {
    console.error("[dashboard] getCheatDisplayState failed:", e);
    return { godModeActive: false, barrelRollAt: null, monologue: null };
  });
  // Reused so the instructor console (which has no per-team announcement
  // watcher) can surface the same "announced globally" cheat-code messages
  // the projector shows — see components/cheat-code-widget.tsx.
  const activeGlobalAnnouncement = await getActiveGlobalAnnouncement(sessionId);

  return NextResponse.json({
    globalState: gs,
    stateVersion: gs?.stateVersion,
    globalRt,
    globalAvgPublicTrust: avgPublicTrust,
    globalAvgHappiness: avgHappiness,
    sharedSummary,
    ownRegion,
    notifications,
    announcements,
    activeGlobalAnnouncement,
    cheat,
    ghostPreview,
    actor,
  });
}
