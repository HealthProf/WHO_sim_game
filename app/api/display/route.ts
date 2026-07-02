import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { globalState, eventDispatches, events } from "@/lib/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { computeGlobalRt } from "@/lib/model-engine";
import { processDeadlines } from "@/lib/deadline";
import { buildSummaryReport } from "@/lib/summary-report";
import { getSnapVoteState } from "@/lib/snap-vote";
import { getActiveGlobalAnnouncement } from "@/lib/announcements";
import { computeFinalResults } from "@/lib/final-results";

// Public-safe read-only endpoint for the projector display. No auth (route is
// protected only by an unguessable URL token — see /display/[token]). While
// the game is active this MUST NEVER expose: decisions, resource_allocation
// _json, team-private model_state fields (fund/PPE/antivirals/HCW surge/
// political tension/public trust), or any event not explicitly revealed via
// the "Push to Global Display" facilitator action. Once the simulation is
// marked completed, the round-by-round summary report (which is
// deliberately cross-team) is included so the projector can show the
// after-action debrief to the whole room.
//
// Also opportunistically runs deadline enforcement — see the note in
// app/api/dashboard/route.ts. The projector is typically left open for the
// entire session, so this is actually the most reliable polling source.
export async function GET() {
  await processDeadlines().catch(() => {});

  const allRegions = await db.query.regions.findMany();
  const allModelState = await db.query.modelState.findMany();
  const gs = await db.query.globalState.findFirst({ where: eq(globalState.id, 1) });
  const globalRt = await computeGlobalRt();

  const feedItems = await db.query.globalFeedItems.findMany({
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 30,
  });

  const publicRegionData = allRegions.map((r) => {
    const s = allModelState.find((m) => m.regionId === r.id)!;
    return {
      regionId: r.id,
      fullName: r.fullName,
      confirmedCases: s.confirmedCases,
      deaths: s.deaths,
      rt: s.rt,
      populationWeight: r.populationWeight,
    };
  });

  const rounds = gs?.simulationStatus === "completed" ? await buildSummaryReport() : null;
  const finalResults = gs?.simulationStatus === "completed" ? await computeFinalResults() : null;
  const globalAvgHappiness = allModelState.length ? Math.round(allModelState.reduce((s, m) => s + m.populationHappinessIndex, 0) / allModelState.length) : 0;
  const globalAvgPublicTrust = allModelState.length ? Math.round(allModelState.reduce((s, m) => s + m.publicTrustIndex, 0) / allModelState.length) : 0;
  const totalConfirmed = allModelState.reduce((s, m) => s + m.confirmedCases, 0);
  const totalDeaths = allModelState.reduce((s, m) => s + m.deaths, 0);
  // Public display never reveals live vote breakdowns while a vote is open
  // (same herd-voting concern as the team-facing endpoint) — only the
  // question, countdown, and response count; the full tally appears once
  // it's closed.
  const snapVote = await getSnapVoteState({ forInstructor: false });
  const activeAnnouncement = await getActiveGlobalAnnouncement();

  // Public-safe deadline countdowns: event title + time remaining only, no
  // region attribution (which regions have/haven't responded stays on the
  // instructor's Control page, not the shared projector). Dispatches of the
  // same event fired together share a deadline, so dedupe by event.
  const openDispatches = await db.query.eventDispatches.findMany({
    where: and(eq(eventDispatches.status, "dispatched"), isNotNull(eventDispatches.deadlineAt)),
  });
  const seenEventIds = new Set<string>();
  const activeDeadlines: { eventTitle: string; deadlineAt: Date }[] = [];
  for (const d of openDispatches.sort((a, b) => new Date(a.deadlineAt!).getTime() - new Date(b.deadlineAt!).getTime())) {
    if (seenEventIds.has(d.eventId)) continue;
    seenEventIds.add(d.eventId);
    const event = await db.query.events.findFirst({ where: eq(events.id, d.eventId) });
    if (event) activeDeadlines.push({ eventTitle: event.title, deadlineAt: d.deadlineAt! });
  }

  // Only reference events/consequence text that's still part of this build
  // — the ticker already only ever draws from globalFeedItems rows this app
  // itself inserted (real event titles/consequencesJson/snap-vote/pledge
  // text), so there's no separate filtering needed here; see the comment on
  // globalFeedItems in lib/db/schema.ts.
  return NextResponse.json({
    currentDay: gs?.currentDay,
    escalationState: gs?.escalationState,
    mediaPressureIndex: gs?.mediaPressureIndex,
    simulationStatus: gs?.simulationStatus,
    simulationStartedAt: gs?.simulationStartedAt,
    pausedAccumulatedMs: gs?.pausedAccumulatedMs,
    pausedAt: gs?.pausedAt,
    fastModeMultiplier: gs?.fastModeMultiplier,
    gameDaysPerRealMinute: gs?.gameDaysPerRealMinute,
    totalGameDays: gs?.totalGameDays,
    globalRt,
    totalConfirmed,
    totalDeaths,
    globalAvgHappiness,
    globalAvgPublicTrust,
    regions: publicRegionData,
    feedItems: feedItems.map((f) => ({ id: f.id, text: f.headlineText, createdAt: f.createdAt })),
    rounds,
    finalResults,
    snapVote: snapVote.current,
    activeDeadlines,
    activeAnnouncement,
  });
}
