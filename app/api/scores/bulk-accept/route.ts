import { NextRequest, NextResponse } from "next/server";
import { requireInstructorActor } from "@/lib/session-context";
import { scoreDecision } from "@/lib/score-decision";
import { logAnalyticsEvent } from "@/lib/analytics";

// POST { decisionIds, includeReview? }: accept the rule-based provisional
// grade for each listed decision in one click. Grades that need review
// (critical failures, mandatory-review events, no structured choice) are
// skipped unless includeReview is true, so the decision matrix's mandatory
// review rule is only bypassed when the facilitator explicitly chooses to.
export async function POST(req: NextRequest) {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json();
  const decisionIds = Array.isArray(body.decisionIds) ? (body.decisionIds as number[]) : [];
  const includeReview = body.includeReview === true;

  const results = [];
  for (const decisionId of decisionIds) {
    try {
      const score = await scoreDecision(sessionId, { decisionId, acceptProvisional: true, confirmReview: includeReview }, actor!.userId!);
      await logAnalyticsEvent({
        sessionId,
        mode: actor!.mode,
        eventType: "score_submitted",
        actorRole: actor!.role,
        userId: actor!.userId,
        metadata: { decisionId, tier: score.tier, fastPathed: score.fastPathed, bulk: true, includeReview },
      });
      results.push({ decisionId, ok: true, score });
    } catch (e) {
      results.push({ decisionId, ok: false, error: (e as Error).message });
    }
  }

  return NextResponse.json({ results });
}
