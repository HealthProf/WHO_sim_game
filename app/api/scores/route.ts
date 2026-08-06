import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decisions, eventDispatches, events, scores, teams, modelState } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { requireInstructorActor } from "@/lib/session-context";
import { computeCalibrationAdjustment, computeCompositePct, defaultScoresForTier, tierForCompositePct, type Tier } from "@/lib/scoring";
import { applyModelDelta, applyOptimalShadowDelta, clamp } from "@/lib/model-engine";
import { pushConsequence } from "@/lib/consequences";
import { maybeAnnounceResolution, announceDecisionRevealed } from "@/lib/announcements";
import { maybeStakeholderReact } from "@/lib/stakeholders";
import type { ModelDelta } from "@/lib/db/seed-data/events";

// GET: priority-sorted scoring inbox. Sort key (see design discussion on
// facilitator triage): mandatory-review flag first, then time remaining on
// the *next* HARD deadline in the queue, then plain age. Every unscored
// decision also carries a `suggestedTier` (from its structured choice) so
// the UI can offer a one-click "Accept Suggested" fast path.
export async function GET() {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const allDecisions = await db.query.decisions.findMany({ where: eq(decisions.sessionId, sessionId) });
  const scoredIds = new Set((await db.query.scores.findMany({ where: eq(scores.sessionId, sessionId) })).map((s) => s.decisionId));
  const unscored = allDecisions.filter((d) => !scoredIds.has(d.id));

  const dispatchIds = [...new Set(unscored.map((d) => d.eventDispatchId).filter((id): id is number => id != null))];
  const allDispatches = dispatchIds.length > 0 ? await db.query.eventDispatches.findMany({ where: and(eq(eventDispatches.sessionId, sessionId), inArray(eventDispatches.id, dispatchIds)) }) : [];
  const eventIds = [...new Set(allDispatches.map((d) => d.eventId))];
  const allEvents = eventIds.length > 0 ? await db.query.events.findMany({ where: inArray(events.id, eventIds) }) : [];
  const teamIds = [...new Set(unscored.map((d) => d.teamId))];
  const allTeams = teamIds.length > 0 ? await db.query.teams.findMany({ where: and(eq(teams.sessionId, sessionId), inArray(teams.id, teamIds)) }) : [];

  const enriched = unscored.map((d) => {
    const dispatch = allDispatches.find((disp) => disp.id === d.eventDispatchId) ?? null;
    const event = dispatch ? (allEvents.find((e) => e.id === dispatch.eventId) ?? null) : null;
    const team = allTeams.find((t) => t.id === d.teamId) ?? null;

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
  });

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
  const { actor, error } = await requireInstructorActor();
  if (error) return error;

  const body = await req.json();
  try {
    const score = await scoreDecision(actor!.sessionId, body, actor!.userId!);
    return NextResponse.json({ score });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function scoreDecision(
  sessionId: string,
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

  const decision = await db.query.decisions.findFirst({ where: and(eq(decisions.sessionId, sessionId), eq(decisions.id, decisionId)) });
  if (!decision) throw new Error("Decision not found");

  const dispatch = await db.query.eventDispatches.findFirst({ where: and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.id, decision.eventDispatchId)) });
  const event = dispatch ? await db.query.events.findFirst({ where: eq(events.id, dispatch.eventId) }) : null;
  if (!dispatch || !event) throw new Error("Event not found");

  let evidenceScore: number, politicalScore: number, equityScore: number, fastPathed: boolean;

  const options = (event.structuredOptionsJson as { label: string; suggestedTier: Tier }[] | null) ?? null;
  const suggestedTier = options?.find((o) => o.label === decision.structuredChoice)?.suggestedTier ?? null;

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
      sessionId,
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

  const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.id, decision.teamId)) });
  if (team) {
    const deltaJson = (event.modelDeltaJson as Record<string, ModelDelta[]>) ?? {};
    const deltas = deltaJson[tier] ?? [];
    await applyModelDelta({
      sessionId,
      deltas,
      submittingRegionId: team.regionId,
      reason: `${event.id} scored: ${tier}`,
    });
    // Mirror the OPTIMAL-tier delta onto the counterfactual shadow
    // simulation regardless of what tier actually happened — see
    // simulation-docs and lib/model-engine.ts for why (debrief item 7).
    await applyOptimalShadowDelta(sessionId, deltaJson.OPTIMAL ?? [], team.regionId);
    const afterState = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, team.regionId)) });
    await pushConsequence({
      sessionId,
      event,
      dispatchId: dispatch.id,
      teamId: team.id,
      regionId: team.regionId,
      tier,
      deltas,
      actorUserId: scoredByUserId,
      afterState: afterState ?? undefined,
    });
    await announceDecisionRevealed({
      sessionId,
      eventId: event.id,
      eventTitle: event.title,
      regionId: team.regionId,
      submittingTeamId: team.id,
      structuredChoice: decision.structuredChoice,
      tier,
    });
    await maybeStakeholderReact(sessionId, team.id, tier);
  }

  await db.update(eventDispatches).set({ status: "scored" }).where(eq(eventDispatches.id, dispatch.id));
  await maybeAnnounceResolution(sessionId, event.id);

  return score;
}
