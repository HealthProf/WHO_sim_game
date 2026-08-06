import { NextResponse } from "next/server";
import { requireActor } from "@/lib/session-context";
import { buildSummaryReport, computeTeamHighlights } from "@/lib/summary-report";
import { computeFinalResults } from "@/lib/final-results";
import { computeAllTeamChapters } from "@/lib/team-chapter";

// Round-by-round after-action summary, available to any authenticated user
// (team or instructor) — see lib/summary-report.ts for why this is
// deliberately cross-team once the game has ended. Students additionally
// get their own team's personalized 3-strongest/3-weakest breakdown here
// (see 03-events.md's EVT-014 implementation note); the instructor's
// debrief page shows every team's via /api/instructor/debrief.
export async function GET() {
  const { actor, error } = await requireActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const rounds = await buildSummaryReport(sessionId);
  const allHighlights = await computeTeamHighlights(sessionId);
  const myHighlights = actor!.regionId ? allHighlights.find((h) => h.regionId === actor!.regionId) ?? null : null;
  const finalResults = await computeFinalResults(sessionId);
  const allChapters = await computeAllTeamChapters(sessionId);
  const myChapter = actor!.regionId ? allChapters.find((c) => c.regionId === actor!.regionId) ?? null : null;

  return NextResponse.json({ rounds, myHighlights, finalResults, myChapter });
}
