import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eventDispatches, events, teams } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { requireInstructorActor } from "@/lib/session-context";
import { logAnalyticsEvent } from "@/lib/analytics";
import { pendingSubmissions, provisionalGradeFor, scoreDecision } from "@/lib/score-decision";
import type { Tier } from "@/lib/scoring";

// GET: priority-sorted scoring inbox. Every unscored decision carries a
// rule-based provisional grade (lib/auto-grade.ts): per-dimension scores, the
// resulting tier, the reasons, and whether it needs the facilitator's review.
// Sort: needs-review first, then the soonest HARD deadline, then age.
export async function GET() {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  // Latest submission per event, still-open events only (resubmissions
  // replace earlier ones; see lib/score-decision.ts pendingSubmissions).
  const unscored = await pendingSubmissions(sessionId);

  const dispatchIds = [...new Set(unscored.map((d) => d.eventDispatchId))];
  const allDispatches = dispatchIds.length > 0 ? await db.query.eventDispatches.findMany({ where: and(eq(eventDispatches.sessionId, sessionId), inArray(eventDispatches.id, dispatchIds)) }) : [];
  const eventIds = [...new Set(allDispatches.map((d) => d.eventId))];
  const allEvents = eventIds.length > 0 ? await db.query.events.findMany({ where: inArray(events.id, eventIds) }) : [];
  const teamIds = [...new Set(unscored.map((d) => d.teamId))];
  const allTeams = teamIds.length > 0 ? await db.query.teams.findMany({ where: and(eq(teams.sessionId, sessionId), inArray(teams.id, teamIds)) }) : [];

  const enriched = [];
  for (const d of unscored) {
    const dispatch = allDispatches.find((disp) => disp.id === d.eventDispatchId) ?? null;
    const event = dispatch ? (allEvents.find((e) => e.id === dispatch.eventId) ?? null) : null;
    const team = allTeams.find((t) => t.id === d.teamId) ?? null;
    const options = (event?.structuredOptionsJson as { label: string; suggestedTier: Tier }[] | null) ?? null;
    const suggestedTier = options?.find((o) => o.label === d.structuredChoice)?.suggestedTier ?? null;
    const provisional = event ? await provisionalGradeFor(sessionId, d, event) : null;
    enriched.push({
      decision: d,
      event,
      team,
      dispatch,
      suggestedTier,
      provisional,
      needsReview: provisional?.needsReview ?? true,
      mandatoryReview: !!event?.requiresMandatoryReview,
      ageMs: Date.now() - new Date(d.submittedAt).getTime(),
      deadlineRemainingMs: dispatch?.deadlineAt ? new Date(dispatch.deadlineAt).getTime() - Date.now() : Infinity,
    });
  }

  enriched.sort((a, b) => {
    if (a.needsReview !== b.needsReview) return a.needsReview ? -1 : 1;
    if (a.deadlineRemainingMs !== b.deadlineRemainingMs) return a.deadlineRemainingMs - b.deadlineRemainingMs;
    return b.ageMs - a.ageMs;
  });

  return NextResponse.json({ inbox: enriched });
}

// POST: score one decision. Either explicit per-dimension scores (manual,
// always available) or `acceptProvisional: true` for the rule-based grade;
// a grade that needs review also requires `confirmReview: true`.
export async function POST(req: NextRequest) {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;

  const body = await req.json();
  try {
    const score = await scoreDecision(actor!.sessionId, body, actor!.userId!);
    await logAnalyticsEvent({
      sessionId: actor!.sessionId,
      mode: actor!.mode,
      eventType: "score_submitted",
      actorRole: actor!.role,
      userId: actor!.userId,
      metadata: { decisionId: body.decisionId, tier: score.tier, fastPathed: score.fastPathed },
    });
    return NextResponse.json({ score });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
