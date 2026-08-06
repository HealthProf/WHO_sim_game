// Shared "score this decision without a human in the scoring inbox" path —
// used by lib/deadline.ts's no-response auto-fallback and by demo mode's
// autoplayer/owner-occupied-region decisions (lib/deadline.ts runAutoplayer).
// Both are "nobody is going to open the scoring inbox for this," so both
// fast-path straight to defaultScoresForTier(tier) and apply the same
// model-delta / consequence / announcement pipeline a human-scored decision
// gets — same code, not a parallel simulation.
import { db } from "./db";
import { eventDispatches, modelState, decisions, scores, events, teams } from "./db/schema";
import { and, eq } from "drizzle-orm";
import { computeCompositePct, defaultScoresForTier } from "./scoring";
import { applyModelDelta, applyOptimalShadowDelta } from "./model-engine";
import { pushConsequence } from "./consequences";
import { maybeAnnounceResolution, announceDecisionRevealed } from "./announcements";
import { maybeStakeholderReact } from "./stakeholders";
import type { Tier } from "./db/seed-data/events";

export async function applyFastPathScore(opts: {
  sessionId: string;
  decision: typeof decisions.$inferSelect;
  event: typeof events.$inferSelect;
  regionId: string;
  tier: Tier;
  overrideReason: string;
  // Always the session owner — instructorActions/scores.scoredByUserId stay
  // non-null users.id FKs even when nobody actually reviewed this (see
  // lib/consequences.ts's note on the equivalent auto-fallback case).
  scoredByUserId: number;
}) {
  const { sessionId, decision, event, regionId, tier, overrideReason, scoredByUserId } = opts;

  const dims = defaultScoresForTier(tier);
  const compositePct = computeCompositePct(dims);

  await db.insert(scores).values({
    sessionId,
    decisionId: decision.id,
    evidenceScore: dims.evidenceScore,
    politicalScore: dims.politicalScore,
    equityScore: dims.equityScore,
    rawCompositePct: compositePct,
    calibrationAdjustment: 0,
    compositePct,
    tier,
    suggestedTier: tier,
    fastPathed: true,
    overrideReason,
    scoredByUserId,
  });

  const deltaJson = (event.modelDeltaJson as Record<string, unknown[]>) ?? {};
  const deltas = deltaJson[tier] ?? [];

  await applyModelDelta({
    sessionId,
    deltas: deltas as never,
    submittingRegionId: regionId,
    reason: `${event.id} fast-pathed: ${tier} auto-applied`,
  });
  await applyOptimalShadowDelta(sessionId, (deltaJson.OPTIMAL as never) ?? [], regionId);

  const afterState = await db.query.modelState.findFirst({
    where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, regionId)),
  });
  await pushConsequence({
    sessionId,
    event,
    dispatchId: decision.eventDispatchId,
    teamId: decision.teamId,
    regionId,
    tier,
    deltas: deltas as never,
    actorUserId: scoredByUserId,
    afterState: afterState ?? undefined,
  });
  await announceDecisionRevealed({
    sessionId,
    eventId: event.id,
    eventTitle: event.title,
    regionId,
    submittingTeamId: decision.teamId,
    structuredChoice: decision.structuredChoice,
    tier,
  });
  await maybeStakeholderReact(sessionId, decision.teamId, tier);

  await db.update(eventDispatches).set({ status: "scored" }).where(eq(eventDispatches.id, decision.eventDispatchId));
  await maybeAnnounceResolution(sessionId, event.id);
}

// Resolves a decision's tier from its structuredChoice against the event's
// authored suggestedTier — used when a decision was fast-path-scored (no
// human review), so the applied tier matches the option's own designation
// exactly rather than being re-derived.
export function tierForStructuredChoice(event: typeof events.$inferSelect, structuredChoice: string | null): Tier | null {
  if (!structuredChoice) return null;
  const options = event.structuredOptionsJson as { label: string; suggestedTier: Tier }[] | null;
  return options?.find((o) => o.label === structuredChoice)?.suggestedTier ?? null;
}

export async function teamRegionId(sessionId: string, teamId: number): Promise<string | null> {
  const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.id, teamId)) });
  return team?.regionId ?? null;
}
