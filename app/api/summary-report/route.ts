import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { buildSummaryReport } from "@/lib/summary-report";

// Round-by-round after-action summary, available to any authenticated user
// (team or instructor) — see lib/summary-report.ts for why this is
// deliberately cross-team once the game has ended.
export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const rounds = await buildSummaryReport();
  return NextResponse.json({ rounds });
}
