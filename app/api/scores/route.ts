import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decisions, eventDispatches, events, scores, teams } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireInstructor } from "@/lib/api-helpers";
import { computeCalibrationAdjustment, computeCompositePct, defaultScoresForTier, tierForCompositePct, type Tier } from "@/lib/scoring";
import { applyModelDelta, applyOptimalShadowDelta, clamp } from "@/lib/model-engine";
import { pushConsequence } from "@/lib/consequences";
import { maybeAnnounceResolution, announceDecisionRevealed } from "@/lib/announcements";
import type { ModelDelta } from "@/lib/db/seed-data/events";

// GET: priority-sorted scoring inbox. Sort key (see design discussion on
// facilitator triage): mandatory-review flag first, then time remaining on
// the *next* HARD deadline in the queue, then plain age. Every unscored
// decision also carries a `suggestedTier` (from its structured choice) so
// the UI can offer a one-click "Accept Suggested" fast path.
export async function GET() {
  const { error } = await requireInstructor();
  if (error) return error;

  const allDecisions = await db.query.decisions.findMany();
  const scoredIds = new Set((await db.query.scores.findMany()).map((s) => s.decisionId));
  const unscored = allDecisions.filter((d) => !scoredIds.has(d.id));

  const enriched = await Promise.all(
    unscored.map(async (d) => {
      const dispatch = await db.query.eventDispatches.findFirst({ where: eq(eventDispatches.id, d.eventDispatchId) });
      const event = dispatch ? await db.query.events.findFirst({ where: eq(events.id, dispatch.eventId) }) : null;
      const team = await db.query.teams.findFirst({ where: eq(teams.id, d.teamId) });

      const options = (event?.structuredOptionsJson as { label: string; suggestedTier: Tier }[] | null) ?? null;
      const suggestedTier = options?.find((o) => o.label === d.structuredChoice)?.suggestedTier ?? null;

      const ageMs = Date.now() - new Date(d.submittedAt).getTime();
      const deadlineRemainingMs = dispatch?.deadlineAt ? new Date(dispatch.deadlineAt).getTime() - Date.now() : Infinity;

      return {
        decision: d,
        event,
        team,
        dispatch,
        suggestedTier,
        mandatoryReview: !!event?.requiresMandatoryReview,
        ageMs,
        deadlineRemainingMs,
      };
    })
  );

  enriched.sort((a, b) => {
    if (a.mandatoryReview !== b.mandatoryReview) return a.mandatoryReview ? -1 : 1;
    if (a.deadlineRemainingMs !== b.deadlineRemainingMs) return a.deadlineRemainingMs - b.deadlineRemainingMs;
    return b.ageMs - a.ageMs;
  });

  return NextResponse.json({ inbox: enriched });
}

// POST: score a single decision. Accepts either explicit per-dimension scores
// (full manual scoring, always available) or `acceptSuggested: true` for the
// one-click fast path on non-mandatory-review submissions.
export async function POST(req: NextRequest) {
  const { session, error } = await requireInstructor();
  if (error) return error;

  const body = await req.json();
  try {
    const score = await scoreDecision(body, Number(session!.user.id));
    return NextResponse.json({ score });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function scoreDecision(
  body: {
    decisionId: number;
    acceptSuggested?: boolean;
    evidenceScore?: number;
    politicalScore?: number;
    equityScore?: number;
    overrideReason?: string;
  },
  scoredByUserId: number
) {
  const decisionId = body.decisionId;

  const decision = await db.query.decisions.findFirst({ where: eq(decisions.id, decisionId) });
  if (!decision) throw new Error("Decision not found");

  const dispatch = await db.query.eventDispatches.findFirst({ where: eq(eventDispatches.id, decision.eventDispatchId) });
  const event = dispatch ? await db.query.events.findFirst({ where: eq(events.id, dispatch.eventId) }) : null;
  if (!dispatch || !event) throw new Error("Event not found");

  let evidenceScore: number, politicalScore: number, equityScore: number, fastPathed: boolean, suggestedTier: Tier | null;

  const options = (event.structuredOptionsJson as { label: string; suggestedTier: Tier }[] | null) ?? null;
  suggestedTier = options?.find((o) => o.label === decision.structuredChoice)?.suggestedTier ?? null;

  if (body.acceptSuggested) {
    if (event.requiresMandatoryReview) {
      throw new Error("This event requires full manual review and cannot be fast-pathed.");
    }
    if (!suggestedTier) {
      throw new Error("No suggested tier available for this submission.");
    }
    const dims = defaultScoresForTier(suggestedTier);
    ({ evidenceScore, politicalScore, equityScore } = dims);
    fastPathed = true;
  } else {
    evidenceScore = body.evidenceScore!;
    politicalScore = body.politicalScore!;
    equityScore = body.equityScore!;
    fastPathed = false;
  }

  const rawCompositePct = computeCompositePct({ evidenceScore, politicalScore, equityScore });
  const rawTier = tierForCompositePct(rawCompositePct);
  const calibrationAdjustment = computeCalibrationAdjustment(decision.confidenceLevel, rawTier);
  const compositePct = clamp(rawCompositePct + calibrationAdjustment, 0, 100);
  const tier = tierForCompositePct(compositePct);
  const tierOverridden = !!suggestedTier && tier !== suggestedTier;

  const [score] = await db
    .insert(scores)
    .values({
      decisionId,
      evidenceScore,
      politicalScore,
      equityScore,
      rawCompositePct,
      calibrationAdjustment,
      compositePct,
      tier,
      suggestedTier,
      tierOverridden,
      overrideReason: body.overrideReason ?? null,
      fastPathed,
      scoredByUserId,
    })
    .returning();

  const team = await db.query.teams.findFirst({ where: eq(teams.id, decision.teamId) });
  if (team) {
    const deltaJson = (event.modelDeltaJson as Record<string, ModelDelta[]>) ?? {};
    const deltas = deltaJson[tier] ?? [];
    await applyModelDelta({
      deltas,
      submittingRegionId: team.regionId,
      reason: `${event.id} scored: ${tier}`,
    });
    // Mirror the OPTIMAL-tier delta onto the counterfactual shadow
    // simulation regardless of what tier actually happened — see
    // simulation-docs and lib/model-engine.ts for why (debrief item 7).
    await applyOptimalShadowDelta(deltaJson.OPTIMAL ?? [], team.regionId);
    await pushConsequence({
      event,
      dispatchId: dispatch.id,
      teamId: team.id,
      regionId: team.regionId,
      tier,
      deltas,
      actorUserId: scoredByUserId,
    });
    await announceDecisionRevealed({
      eventId: event.id,
      eventTitle: event.title,
      regionId: team.regionId,
      submittingTeamId: team.id,
      structuredChoice: decision.structuredChoice,
      tier,
    });
  }

  await db.update(eventDispatches).set({ status: "scored" }).where(eq(eventDispatches.id, dispatch.id));
  await maybeAnnounceResolution(event.id);

  return score;
}
