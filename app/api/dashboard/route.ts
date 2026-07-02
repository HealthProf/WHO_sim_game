import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { globalState, teamNotifications } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireSession } from "@/lib/api-helpers";
import { computeGlobalRt } from "@/lib/model-engine";
import { processDeadlines } from "@/lib/deadline";
import { getTeamAnnouncements } from "@/lib/announcements";
import { projectForward } from "@/lib/projection";
import { computeSimClock } from "@/lib/sim-clock";
import { computeFinalResults } from "@/lib/final-results";

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
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  await processDeadlines().catch(() => {});

  const allRegions = await db.query.regions.findMany();
  const allModelState = await db.query.modelState.findMany();
  const gs = await db.query.globalState.findFirst({ where: eq(globalState.id, 1) });
  const globalRt = await computeGlobalRt();

  const sharedSummary = allRegions.map((r) => {
    const s = allModelState.find((m) => m.regionId === r.id)!;
    return {
      regionId: r.id,
      fullName: r.fullName,
      confirmedCases: s.confirmedCases,
      estimatedTrueCasesLow: s.estimatedTrueCasesLow,
      estimatedTrueCasesHigh: s.estimatedTrueCasesHigh,
      deaths: s.deaths,
      rt: s.rt,
      hospitalCapacityPct: s.hospitalCapacityPct,
      surveillanceIndex: s.surveillanceIndex,
    };
  });

  let ownRegion = null;
  let notifications: { id: number; kind: string; message: string; createdAt: Date }[] = [];
  let announcements: Awaited<ReturnType<typeof getTeamAnnouncements>> = [];
  if (session!.user.role === "student" && session!.user.regionId) {
    const s = allModelState.find((m) => m.regionId === session!.user.regionId);
    const r = allRegions.find((r) => r.id === session!.user.regionId);
    if (s && r) {
      ownRegion = {
        ...s,
        profileMarkdown: r.profileMarkdown,
        roleTitle: r.roleTitle,
        hqLocation: r.hqLocation,
        projection: projectForward(s),
      };
    }
    if (session!.user.teamId) {
      notifications = await db.query.teamNotifications.findMany({
        where: eq(teamNotifications.teamId, session!.user.teamId),
        orderBy: [desc(teamNotifications.createdAt)],
        limit: 8,
      });
      announcements = await getTeamAnnouncements(session!.user.teamId);
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
      const finalResults = await computeFinalResults();
      ghostPreview = { worldDeathsPrevented: finalResults.totalDeathsPrevented, worldInfectionsPrevented: finalResults.totalInfectionsPrevented };
    }
  }

  return NextResponse.json({
    globalState: gs,
    globalRt,
    globalAvgPublicTrust: avgPublicTrust,
    globalAvgHappiness: avgHappiness,
    sharedSummary,
    ownRegion,
    notifications,
    announcements,
    ghostPreview,
  });
}
