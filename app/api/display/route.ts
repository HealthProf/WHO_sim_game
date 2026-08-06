import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionState, eventDispatches, events, modelState, gameSessions, globalFeedItems } from "@/lib/db/schema";
import { eq, and, isNotNull, inArray, desc } from "drizzle-orm";
import { computeGlobalRt } from "@/lib/model-engine";
import { processDeadlines } from "@/lib/deadline";
import { buildSummaryReport } from "@/lib/summary-report";
import { getSnapVoteState } from "@/lib/snap-vote";
import { getActiveGlobalAnnouncement } from "@/lib/announcements";
import { computeFinalResults } from "@/lib/final-results";
import { computeAllTeamChapters } from "@/lib/team-chapter";
import { computeWorldHealth } from "@/lib/world-health";

// Public-safe read-only endpoint for the projector display. No auth — gated
// instead by an unguessable displayToken (crypto.randomBytes(24), see
// lib/ids.ts and gameSessions.displayToken) resolved to a session below;
// never the session's primary key. While the game is active this MUST NEVER
// expose: decisions, resource_allocation_json, team-private model_state
// fields (fund/PPE/antivirals/HCW surge/political tension/public trust), or
// any event not explicitly revealed via the "Push to Global Display"
// facilitator action. Once the simulation is marked completed, the
// round-by-round summary report (which is deliberately cross-team) is
// included so the projector can show the after-action debrief to the whole
// room.
//
// Also opportunistically runs deadline enforcement for this session — see
// the note in app/api/dashboard/route.ts. The projector is typically left
// open for the entire session, so this is actually the most reliable
// polling source.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await db.query.gameSessions.findFirst({ where: eq(gameSessions.displayToken, token) });
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const sessionId = session.id;

  await processDeadlines(sessionId).catch(() => {});

  const allRegions = await db.query.regions.findMany();
  const allModelState = await db.query.modelState.findMany({ where: eq(modelState.sessionId, sessionId) });
  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  const globalRt = await computeGlobalRt(sessionId);

  const feedItems = await db.query.globalFeedItems.findMany({
    where: eq(globalFeedItems.sessionId, sessionId),
    orderBy: desc(globalFeedItems.createdAt),
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

  const rounds = gs?.simulationStatus === "completed" ? await buildSummaryReport(sessionId) : null;
  const finalResults = gs?.simulationStatus === "completed" ? await computeFinalResults(sessionId) : null;
  const teamChapters = gs?.simulationStatus === "completed" ? await computeAllTeamChapters(sessionId) : null;
  const globalAvgHappiness = allModelState.length ? Math.round(allModelState.reduce((s, m) => s + m.populationHappinessIndex, 0) / allModelState.length) : 0;
  const globalAvgPublicTrust = allModelState.length ? Math.round(allModelState.reduce((s, m) => s + m.publicTrustIndex, 0) / allModelState.length) : 0;
  const totalConfirmed = allModelState.reduce((s, m) => s + m.confirmedCases, 0);
  const totalDeaths = allModelState.reduce((s, m) => s + m.deaths, 0);
  const worldHealth = computeWorldHealth({ avgPublicTrust: globalAvgPublicTrust, avgHappiness: globalAvgHappiness, escalationState: gs?.escalationState ?? "GREEN", globalRt });
  // Public display never reveals live vote breakdowns while a vote is open
  // (same herd-voting concern as the team-facing endpoint) — only the
  // question, countdown, and response count; the full tally appears once
  // it's closed.
  const snapVote = await getSnapVoteState(sessionId, { forInstructor: false });
  const activeAnnouncement = await getActiveGlobalAnnouncement(sessionId);

  // Public-safe deadline countdowns: event title + time remaining only, no
  // region attribution (which regions have/haven't responded stays on the
  // instructor's Control page, not the shared projector). Dispatches of the
  // same event fired together share a deadline, so dedupe by event.
  const openDispatches = await db.query.eventDispatches.findMany({
    where: and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.status, "dispatched"), isNotNull(eventDispatches.deadlineAt)),
  });
  const uniqueEventIds = [...new Set(openDispatches.map((d) => d.eventId))];
  const dispatchEvents = uniqueEventIds.length > 0 ? await db.query.events.findMany({ where: inArray(events.id, uniqueEventIds) }) : [];
  const seenEventIds = new Set<string>();
  const activeDeadlines: { eventTitle: string; deadlineAt: Date }[] = [];
  for (const d of openDispatches.sort((a, b) => new Date(a.deadlineAt!).getTime() - new Date(b.deadlineAt!).getTime())) {
    if (seenEventIds.has(d.eventId)) continue;
    seenEventIds.add(d.eventId);
    const event = dispatchEvents.find((e) => e.id === d.eventId);
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
    worldHealth,
    regions: publicRegionData,
    feedItems: feedItems.map((f) => ({ id: f.id, text: f.headlineText, createdAt: f.createdAt })),
    rounds,
    finalResults,
    teamChapters,
    snapVote: snapVote.current,
    activeDeadlines,
    activeAnnouncement,
  });
}
