import { NextRequest, NextResponse } from "next/server";
import { requireInstructorActor } from "@/lib/session-context";
import { scoreDecision } from "../route";
import { logAnalyticsEvent } from "@/lib/analytics";

// Bulk fast-path accept — lets the instructor clear a batch of straightforward,
// non-mandatory-review submissions in one click (see triage design: this is
// what turns "6 regions x 3 dimensions" into a handful of clicks).
export async function POST(req: NextRequest) {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json();
  const decisionIds = body.decisionIds as number[];

  const results = [];
  for (const decisionId of decisionIds) {
    try {
      const score = await scoreDecision(sessionId, { decisionId, acceptSuggested: true }, actor!.userId!);
      await logAnalyticsEvent({
        sessionId,
        mode: actor!.mode,
        eventType: "score_submitted",
        actorRole: actor!.role,
        userId: actor!.userId,
        metadata: { decisionId, tier: score.tier, fastPathed: score.fastPathed, bulk: true },
      });
      results.push({ decisionId, ok: true, score });
    } catch (e) {
      results.push({ decisionId, ok: false, error: (e as Error).message });
    }
  }

  return NextResponse.json({ results });
}
