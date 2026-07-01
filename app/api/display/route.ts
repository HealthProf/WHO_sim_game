import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { globalState } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { computeGlobalRt } from "@/lib/model-engine";
import { processDeadlines } from "@/lib/deadline";
import { buildSummaryReport } from "@/lib/summary-report";

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

  return NextResponse.json({
    currentDay: gs?.currentDay,
    escalationState: gs?.escalationState,
    mediaPressureIndex: gs?.mediaPressureIndex,
    simulationStatus: gs?.simulationStatus,
    simulationStartedAt: gs?.simulationStartedAt,
    pausedAccumulatedMs: gs?.pausedAccumulatedMs,
    pausedAt: gs?.pausedAt,
    fastModeMultiplier: gs?.fastModeMultiplier,
    globalRt,
    regions: publicRegionData,
    feedItems: feedItems.map((f) => ({ id: f.id, text: f.headlineText, createdAt: f.createdAt })),
    rounds,
  });
}
