// The single decision-submission path — used by the human team-facing route
// (app/api/decisions/route.ts, a thin auth+validation wrapper over this) and
// by the scripted autoplayer (lib/autoplayer/scripted.ts), so a demo
// session's AI-driven regions go through exactly the same cost/affordability
// logic and history trail a human submission would. Never a parallel
// simulation of "what a submission would do."
import { db } from "./db";
import { decisions, eventDispatches, events, modelState, teams, modelStateHistory } from "./db/schema";
import { and, eq, desc } from "drizzle-orm";
import type { OptionCost, StructuredOption } from "./db/seed-data/events";
import type { ConfidenceLevel } from "./scoring";

// Applies an option's resource cost to the submitting team's own region
// immediately at submission time (see StructuredOption in
// lib/db/seed-data/events.ts — "how much this path costs" is a property of
// the choice itself, independent of how it's later scored). Returns an
// error string if the team can't currently afford it (item 4) instead of
// throwing, so the caller can turn it into a clean 400 response.
async function applyOptionCost(sessionId: string, regionId: string, cost: OptionCost, reason: string): Promise<string | null> {
  const state = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, regionId)) });
  if (!state) return "Region state not found";

  const fundCost = cost.fund ?? 0;
  const ppeCost = cost.ppeDays ?? 0;
  const antiviralsCost = cost.antivirals ?? 0;
  if (state.fundRemaining < fundCost) return `This option costs $${fundCost.toLocaleString()} — you only have $${state.fundRemaining.toLocaleString()} available.`;
  if (state.ppeDaysRemaining < ppeCost) return `This option costs ${ppeCost} PPE-days — you only have ${state.ppeDaysRemaining} available.`;
  if (state.antiviralsRemaining < antiviralsCost) return `This option costs ${antiviralsCost} antiviral doses — you only have ${state.antiviralsRemaining} available.`;

  await db
    .update(modelState)
    .set({
      fundRemaining: state.fundRemaining - fundCost,
      ppeDaysRemaining: state.ppeDaysRemaining - ppeCost,
      antiviralsRemaining: state.antiviralsRemaining - antiviralsCost,
      updatedAt: new Date(),
    })
    .where(and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, regionId)));

  const updated = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, regionId)) });
  if (updated) await db.insert(modelStateHistory).values({ sessionId, regionId, day: updated.day, snapshotJson: updated, reason });
  return null;
}

// Refunds a previously-charged option's cost — used when a team (or the
// autoplayer) resubmits a decision before it's scored (each resubmission is
// a new row, see below), so switching options doesn't double-charge the
// earlier choice.
async function refundOptionCost(sessionId: string, regionId: string, cost: OptionCost, reason: string) {
  const state = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, regionId)) });
  if (!state) return;
  await db
    .update(modelState)
    .set({
      fundRemaining: state.fundRemaining + (cost.fund ?? 0),
      ppeDaysRemaining: state.ppeDaysRemaining + (cost.ppeDays ?? 0),
      antiviralsRemaining: state.antiviralsRemaining + (cost.antivirals ?? 0),
      updatedAt: new Date(),
    })
    .where(and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, regionId)));
  const updated = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, regionId)) });
  if (updated) await db.insert(modelStateHistory).values({ sessionId, regionId, day: updated.day, snapshotJson: updated, reason });
}

export type ActorKind = "team" | "owner" | "autoplayer" | "system";

export interface SubmitDecisionOpts {
  sessionId: string;
  teamId: number;
  eventDispatchId: number;
  structuredChoice: string | null;
  rationaleText: string;
  resourceAllocationJson?: unknown;
  coordinatedWithTeamsJson?: unknown;
  confidenceLevel: ConfidenceLevel | null;
  actor: { kind: ActorKind; userId: number | null };
}

export type SubmitDecisionResult =
  | { decision: typeof decisions.$inferSelect }
  | { error: string };

// Allows resubmission before the deadline (per 05-product-requirements.md
// §3) — each submission is a new row, so full revision history is retained
// rather than overwritten. Callers (the human route and the autoplayer) are
// both expected to have already verified the dispatch belongs to this
// session and team, and isn't already scored/closed — this function focuses
// on the cost/affordability and persistence logic common to both.
export async function submitDecision(opts: SubmitDecisionOpts): Promise<SubmitDecisionResult> {
  const { sessionId, teamId, eventDispatchId, structuredChoice, rationaleText, confidenceLevel, actor } = opts;

  const dispatch = await db.query.eventDispatches.findFirst({
    where: and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.id, eventDispatchId)),
  });
  if (!dispatch) return { error: "Dispatch not found" };
  if (dispatch.targetTeamId !== teamId) return { error: "This event is not targeted at this team" };
  if (dispatch.status === "scored" || dispatch.status === "closed") {
    return { error: "This event has already been scored and closed" };
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, dispatch.eventId) });
  if (!event) return { error: "Event not found" };

  if (event.isAllocationEvent) {
    const allocation = opts.resourceAllocationJson as Record<string, number> | undefined;
    const total = Object.values(allocation ?? {}).reduce((a, b) => a + b, 0);
    if (!allocation || total !== 180000) {
      return { error: `Allocation must sum to exactly 180,000 doses (currently ${total}).` };
    }
  }

  const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.id, teamId)) });
  if (!team) return { error: "Team not found" };

  const options = (event.structuredOptionsJson as StructuredOption[] | null) ?? null;
  const chosenOption = options?.find((o) => o.label === structuredChoice) ?? null;

  // Refund whatever the team's most recent (unscored) prior submission for
  // this dispatch already cost, before charging the newly-chosen option —
  // resubmission before scoring is allowed and shouldn't double-charge if
  // the choice changes.
  const priorDecision = await db.query.decisions.findFirst({
    where: and(eq(decisions.sessionId, sessionId), eq(decisions.eventDispatchId, eventDispatchId)),
    orderBy: [desc(decisions.submittedAt)],
  });
  if (priorDecision?.structuredChoice) {
    const priorOption = options?.find((o) => o.label === priorDecision.structuredChoice);
    if (priorOption?.cost) {
      await refundOptionCost(sessionId, team.regionId, priorOption.cost, `${event.id}: refunded cost of previous choice (${priorOption.label}) on resubmission`);
    }
  }

  if (chosenOption?.cost) {
    const affordabilityError = await applyOptionCost(sessionId, team.regionId, chosenOption.cost, `${event.id}: chose option ${chosenOption.label}`);
    if (affordabilityError) return { error: affordabilityError };
  }

  const [decision] = await db
    .insert(decisions)
    .values({
      sessionId,
      eventDispatchId,
      teamId,
      submittedByUserId: actor.userId,
      actorKind: actor.kind,
      structuredChoice,
      rationaleText,
      resourceAllocationJson: opts.resourceAllocationJson ?? null,
      coordinatedWithTeamsJson: opts.coordinatedWithTeamsJson ?? null,
      confidenceLevel,
    })
    .returning();

  await db.update(eventDispatches).set({ status: "responded" }).where(eq(eventDispatches.id, eventDispatchId));

  return { decision };
}
