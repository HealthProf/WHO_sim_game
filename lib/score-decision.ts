// Scoring a team's decision (moved out of app/api/scores/route.ts in
// Release 2 so the scoring inbox, "accept all", and the auto-accept tick all
// share one path). Every query is scoped to the session.
import { db } from "./db";
import { decisions, eventDispatches, events, scores, teams, modelState } from "./db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { computeCalibrationAdjustment, computeCompositePct, tierForCompositePct, type Tier } from "./scoring";
import { applyModelDelta, applyOptimalShadowDelta, clamp } from "./model-engine";
import { pushConsequence } from "./consequences";
import { maybeAnnounceResolution, announceDecisionRevealed } from "./announcements";
import { maybeStakeholderReact } from "./stakeholders";
import type { ModelDelta } from "./db/seed-data/events";
import { gradeDecision, type ProvisionalGrade } from "./auto-grade";
import { varyDeltas } from "./outcome-variance";
import { applyDisruptionConsequences } from "./disruptors";

type DecisionRow = typeof decisions.$inferSelect;
type EventRow = typeof events.$inferSelect;

// Gathers the session context the rule-based grader needs (current CFR per
// region; the team's EVT-006 allocation when grading EVT-012) and grades.
export async function provisionalGradeFor(sessionId: string, decision: DecisionRow, event: EventRow): Promise<ProvisionalGrade> {
  let cfrMultiplierByRegion: Record<string, number> | undefined;
  let priorAllocation: Record<string, number> | null = null;
  if (event.isAllocationEvent) {
    const states = await db.query.modelState.findMany({ where: eq(modelState.sessionId, sessionId) });
    cfrMultiplierByRegion = Object.fromEntries(states.map((s) => [s.regionId, s.cfrMultiplier]));
    if (event.id === "EVT-012") {
      const teamDecisions = await db.query.decisions.findMany({
        where: and(eq(decisions.sessionId, sessionId), eq(decisions.teamId, decision.teamId)),
      });
      const dispatchIds = teamDecisions.map((d) => d.eventDispatchId);
      if (dispatchIds.length > 0) {
        const dispatches = await db.query.eventDispatches.findMany({ where: eq(eventDispatches.sessionId, sessionId) });
        const evt006Dispatch = new Set(dispatches.filter((d) => d.eventId === "EVT-006").map((d) => d.id));
        const prior = teamDecisions.find((d) => evt006Dispatch.has(d.eventDispatchId));
        priorAllocation = (prior?.resourceAllocationJson as Record<string, number> | null) ?? null;
      }
    }
  }
  return gradeDecision({
    event: {
      id: event.id,
      minRationaleWords: event.minRationaleWords,
      isAllocationEvent: event.isAllocationEvent,
      requiresMandatoryReview: event.requiresMandatoryReview,
      structuredOptionsJson: (event.structuredOptionsJson as { label: string; suggestedTier: Tier }[] | null) ?? null,
    },
    decision,
    cfrMultiplierByRegion,
    priorAllocation,
  });
}

export async function isLatestSubmission(sessionId: string, decision: DecisionRow): Promise<boolean> {
  const all = await db.query.decisions.findMany({
    where: and(eq(decisions.sessionId, sessionId), eq(decisions.eventDispatchId, decision.eventDispatchId), eq(decisions.teamId, decision.teamId)),
  });
  return all.every((d) => d.id <= decision.id);
}

// The decisions the facilitator still needs to score: only the latest
// submission per dispatch, and only while the dispatch is still open
// (dispatched/responded). Shared by the inbox and auto-accept.
export async function pendingSubmissions(sessionId: string): Promise<DecisionRow[]> {
  const all = await db.query.decisions.findMany({ where: eq(decisions.sessionId, sessionId) });
  const scored = new Set((await db.query.scores.findMany({ where: eq(scores.sessionId, sessionId) })).map((s) => s.decisionId));
  const openDispatchIds = new Set(
    (await db.query.eventDispatches.findMany({ where: eq(eventDispatches.sessionId, sessionId) }))
      .filter((d) => d.status === "dispatched" || d.status === "responded")
      .map((d) => d.id)
  );
  const latest = new Map<string, DecisionRow>();
  for (const d of all) {
    const key = `${d.eventDispatchId}:${d.teamId}`;
    const prev = latest.get(key);
    if (!prev || d.id > prev.id) latest.set(key, d);
  }
  return [...latest.values()].filter((d) => !scored.has(d.id) && openDispatchIds.has(d.eventDispatchId));
}

export interface ScoreBody {
  decisionId: number;
  // Accept the rule-based provisional grade (lib/auto-grade.ts).
  // acceptSuggested is the older name for the same thing.
  acceptProvisional?: boolean;
  acceptSuggested?: boolean;
  // Required to accept a provisional grade that needs review.
  confirmReview?: boolean;
  evidenceScore?: number;
  politicalScore?: number;
  equityScore?: number;
  overrideReason?: string;
}

function validDim(n: unknown): n is number {
  return Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 4;
}

export async function scoreDecision(sessionId: string, body: ScoreBody, scoredByUserId: number, opts: { rng?: () => number } = {}) {
  const decisionId = body.decisionId;

  const decision = await db.query.decisions.findFirst({ where: and(eq(decisions.sessionId, sessionId), eq(decisions.id, decisionId)) });
  if (!decision) throw new Error("Decision not found");

  const dispatch = await db.query.eventDispatches.findFirst({ where: and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.id, decision.eventDispatchId)) });
  const event = dispatch ? await db.query.events.findFirst({ where: eq(events.id, dispatch.eventId) }) : null;
  if (!dispatch || !event) throw new Error("Event not found");

  // Teams may resubmit before the deadline (each submission is a new row,
  // see lib/decisions.ts), so only the latest submission for a dispatch is
  // ever scored.
  if (!(await isLatestSubmission(sessionId, decision))) {
    throw new Error("A newer submission exists for this event; score that one instead.");
  }

  const grade = await provisionalGradeFor(sessionId, decision, event);

  let evidenceScore: number, politicalScore: number, equityScore: number, fastPathed: boolean;
  if (body.acceptProvisional || body.acceptSuggested) {
    if (grade.needsReview && !body.confirmReview) {
      throw new Error(`Needs your review: ${grade.reviewReason}`);
    }
    ({ evidenceScore, politicalScore, equityScore } = grade.scores);
    fastPathed = true;
  } else {
    if (!validDim(body.evidenceScore) || !validDim(body.politicalScore) || !validDim(body.equityScore)) {
      throw new Error("Each dimension needs a score from 1 to 4.");
    }
    evidenceScore = body.evidenceScore;
    politicalScore = body.politicalScore;
    equityScore = body.equityScore;
    fastPathed = false;
  }

  const rawCompositePct = computeCompositePct({ evidenceScore, politicalScore, equityScore });
  const rawTier = tierForCompositePct(rawCompositePct);
  const calibrationAdjustment = computeCalibrationAdjustment(decision.confidenceLevel, rawTier);
  const compositePct = clamp(rawCompositePct + calibrationAdjustment, 0, 100);
  const tier = tierForCompositePct(compositePct);
  const tierOverridden = tier !== grade.tier;

  const deltaJson = (event.modelDeltaJson as Record<string, ModelDelta[]>) ?? {};
  const appliedDeltas = varyDeltas(deltaJson[tier] ?? [], opts.rng);

  // Claim the dispatch before applying anything: one guarded UPDATE, so two
  // concurrent scorings (same decision, or two submissions for the same
  // event) can never both apply effects. If the score insert then fails,
  // the claim is compensated back (no db.transaction() on neon-http).
  const claimed = await db
    .update(eventDispatches)
    .set({ status: "scored" })
    .where(and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.id, dispatch.id), inArray(eventDispatches.status, ["dispatched", "responded"])))
    .returning();
  if (claimed.length === 0) throw new Error("This event has already been scored or closed.");

  let score;
  try {
    [score] = await db
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
        suggestedTier: grade.tier,
        tierOverridden,
        overrideReason: body.overrideReason ?? null,
        fastPathed,
        scoredByUserId,
        appliedDeltasJson: appliedDeltas,
        gradeReasonsJson: grade.reasons,
      })
      .returning();
  } catch (e) {
    await db
      .update(eventDispatches)
      .set({ status: dispatch.status })
      .where(and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.id, dispatch.id)));
    throw e;
  }

  const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.id, decision.teamId)) });
  if (team) {
    await applyModelDelta({ sessionId, deltas: appliedDeltas, submittingRegionId: team.regionId, reason: `${event.id} scored: ${tier}` });
    // The counterfactual "every call Optimal" shadow stays deterministic:
    // it's the debrief's baseline, so luck shouldn't move it.
    await applyOptimalShadowDelta(sessionId, deltaJson.OPTIMAL ?? [], team.regionId);
    const afterState = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, team.regionId)) });
    await pushConsequence({
      sessionId,
      event,
      dispatchId: dispatch.id,
      teamId: team.id,
      regionId: team.regionId,
      tier,
      deltas: appliedDeltas,
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
    await applyDisruptionConsequences({ sessionId, dispatch, structuredChoice: decision.structuredChoice, submittedAt: decision.submittedAt, regionId: team.regionId });
  }

  await maybeAnnounceResolution(sessionId, event.id);

  return score;
}
