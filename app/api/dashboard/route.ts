import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { globalState } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/api-helpers";
import { computeGlobalRt } from "@/lib/model-engine";

// Polled every ~15s by team dashboards (see 07-open-questions.md Q4). Returns
// the shared Global Situation Summary for every region, plus the requesting
// team's own private resource/tension/trust ledger layered on top — never the
// other teams' private fields (04-regions.md's data-access-layer note).
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

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
  if (session!.user.role === "student" && session!.user.regionId) {
    const s = allModelState.find((m) => m.regionId === session!.user.regionId);
    const r = allRegions.find((r) => r.id === session!.user.regionId);
    if (s && r) {
      ownRegion = {
        ...s,
        profileMarkdown: r.profileMarkdown,
        roleTitle: r.roleTitle,
        hqLocation: r.hqLocation,
      };
    }
  }

  // Instructor sees every region's full private state.
  const allRegionsFull = session!.user.role === "instructor" ? allModelState : null;

  return NextResponse.json({
    globalState: gs,
    globalRt,
    sharedSummary,
    ownRegion,
    allRegionsFull,
  });
}
