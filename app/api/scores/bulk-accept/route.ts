import { NextRequest, NextResponse } from "next/server";
import { requireInstructor } from "@/lib/api-helpers";
import { scoreDecision } from "../route";

// Bulk fast-path accept — lets the instructor clear a batch of straightforward,
// non-mandatory-review submissions in one click (see triage design: this is
// what turns "6 regions x 3 dimensions" into a handful of clicks).
export async function POST(req: NextRequest) {
  const { session, error } = await requireInstructor();
  if (error) return error;

  const body = await req.json();
  const decisionIds = body.decisionIds as number[];

  const results = [];
  for (const decisionId of decisionIds) {
    try {
      const score = await scoreDecision({ decisionId, acceptSuggested: true }, Number(session!.user.id));
      results.push({ decisionId, ok: true, score });
    } catch (e) {
      results.push({ decisionId, ok: false, error: (e as Error).message });
    }
  }

  return NextResponse.json({ results });
}
