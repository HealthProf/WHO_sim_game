import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { buildSummaryReport, computeTeamHighlights } from "@/lib/summary-report";

// Round-by-round after-action summary, available to any authenticated user
// (team or instructor) — see lib/summary-report.ts for why this is
// deliberately cross-team once the game has ended. Students additionally
// get their own team's personalized 3-strongest/3-weakest breakdown here
// (see 03-events.md's EVT-014 implementation note); the instructor's
// debrief page shows every team's via /api/instructor/debrief.
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const rounds = await buildSummaryReport();
  const allHighlights = await computeTeamHighlights();
  const myHighlights = session!.user.regionId ? allHighlights.find((h) => h.regionId === session!.user.regionId) ?? null : null;

  return NextResponse.json({ rounds, myHighlights });
}
