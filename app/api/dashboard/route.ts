import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { globalState, teamNotifications } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireSession } from "@/lib/api-helpers";
import { computeGlobalRt } from "@/lib/model-engine";
import { processDeadlines } from "@/lib/deadline";

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
    if (session!.user.teamId) {
      notifications = await db.query.teamNotifications.findMany({
        where: eq(teamNotifications.teamId, session!.user.teamId),
        orderBy: [desc(teamNotifications.createdAt)],
        limit: 8,
      });
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
    notifications,
  });
}
