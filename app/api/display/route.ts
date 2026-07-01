import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { globalState } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { computeGlobalRt } from "@/lib/model-engine";

// Public-safe read-only endpoint for the projector display. No auth (route is
// protected only by an unguessable URL token — see /display/[token]). This
// MUST NEVER expose: decisions, resource_allocation_json, team-private
// model_state fields (fund/PPE/antivirals/HCW surge/political tension/public
// trust), or any event not explicitly revealed via the "Push to Global
// Display" facilitator action.
export async function GET() {
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

  return NextResponse.json({
    currentDay: gs?.currentDay,
    escalationState: gs?.escalationState,
    mediaPressureIndex: gs?.mediaPressureIndex,
    simulationStatus: gs?.simulationStatus,
    globalRt,
    regions: publicRegionData,
    feedItems: feedItems.map((f) => ({ id: f.id, text: f.headlineText, createdAt: f.createdAt })),
  });
}
