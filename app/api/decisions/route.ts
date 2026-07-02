import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decisions, eventDispatches, events, modelState, teams, modelStateHistory } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireSession } from "@/lib/api-helpers";
import type { OptionCost, StructuredOption } from "@/lib/db/seed-data/events";

// Applies an option's resource cost to the submitting team's own region
// immediately at submission time (see StructuredOption in
// lib/db/seed-data/events.ts — "how much this path costs" is a property of
// the choice itself, independent of how it's later scored). Returns an
// error string if the team can't currently afford it (item 4) instead of
// throwing, so the caller can turn it into a clean 400 response.
async function applyOptionCost(regionId: string, cost: OptionCost, reason: string): Promise<string | null> {
  const state = await db.query.modelState.findFirst({ where: eq(modelState.regionId, regionId) });
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
    .where(eq(modelState.regionId, regionId));

  const updated = await db.query.modelState.findFirst({ where: eq(modelState.regionId, regionId) });
  if (updated) await db.insert(modelStateHistory).values({ regionId, day: updated.day, snapshotJson: updated, reason });
  return null;
}

// Refunds a previously-charged option's cost — used when a team resubmits a
// decision before it's scored (each resubmission is a new row, see below),
// so switching options doesn't double-charge the earlier choice.
async function refundOptionCost(regionId: string, cost: OptionCost, reason: string) {
  const state = await db.query.modelState.findFirst({ where: eq(modelState.regionId, regionId) });
  if (!state) return;
  await db
    .update(modelState)
    .set({
      fundRemaining: state.fundRemaining + (cost.fund ?? 0),
      ppeDaysRemaining: state.ppeDaysRemaining + (cost.ppeDays ?? 0),
      antiviralsRemaining: state.antiviralsRemaining + (cost.antivirals ?? 0),
      updatedAt: new Date(),
    })
    .where(eq(modelState.regionId, regionId));
  const updated = await db.query.modelState.findFirst({ where: eq(modelState.regionId, regionId) });
  if (updated) await db.insert(modelStateHistory).values({ regionId, day: updated.day, snapshotJson: updated, reason });
}

// POST: a team submits a decision for a dispatch targeted at them. Allows
// resubmission before the deadline (per 05-product-requirements.md §3) —
// each submission is a new row, so full revision history is retained rather
// than overwritten.
export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (session!.user.role !== "student" || !session!.user.teamId) {
    return NextResponse.json({ error: "Only teams can submit decisions" }, { status: 403 });
  }

  const body = await req.json();
  const eventDispatchId = body.eventDispatchId as number;

  const dispatch = await db.query.eventDispatches.findFirst({ where: eq(eventDispatches.id, eventDispatchId) });
  if (!dispatch) return NextResponse.json({ error: "Dispatch not found" }, { status: 404 });
  if (dispatch.targetTeamId !== session!.user.teamId) {
    return NextResponse.json({ error: "This event is not targeted at your team" }, { status: 403 });
  }
  if (dispatch.status === "scored" || dispatch.status === "closed") {
    return NextResponse.json({ error: "This event has already been scored and closed" }, { status: 409 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, dispatch.eventId) });
  const rationaleText = (body.rationaleText as string) ?? "";

  if (event?.isAllocationEvent) {
    const allocation = body.resourceAllocationJson as Record<string, number> | undefined;
    const total = Object.values(allocation ?? {}).reduce((a, b) => a + b, 0);
    if (!allocation || total !== 180000) {
      return NextResponse.json({ error: `Allocation must sum to exactly 180,000 doses (currently ${total}).` }, { status: 400 });
    }
  }

  const confidenceLevel = ["LOW", "MEDIUM", "HIGH"].includes(body.confidenceLevel) ? body.confidenceLevel : null;
  const structuredChoice = (body.structuredChoice as string) ?? null;

  const team = await db.query.teams.findFirst({ where: eq(teams.id, session!.user.teamId) });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const options = (event?.structuredOptionsJson as StructuredOption[] | null) ?? null;
  const chosenOption = options?.find((o) => o.label === structuredChoice) ?? null;

  // Refund whatever the team's most recent (unscored) prior submission for
  // this dispatch already cost, before charging the newly-chosen option —
  // resubmission before scoring is allowed (see below) and shouldn't
  // double-charge if a team changes their mind.
  const priorDecision = await db.query.decisions.findFirst({
    where: eq(decisions.eventDispatchId, eventDispatchId),
    orderBy: [desc(decisions.submittedAt)],
  });
  if (priorDecision?.structuredChoice) {
    const priorOption = options?.find((o) => o.label === priorDecision.structuredChoice);
    if (priorOption?.cost) {
      await refundOptionCost(team.regionId, priorOption.cost, `${event!.id}: refunded cost of previous choice (${priorOption.label}) on resubmission`);
    }
  }

  if (chosenOption?.cost) {
    const affordabilityError = await applyOptionCost(team.regionId, chosenOption.cost, `${event!.id}: chose option ${chosenOption.label}`);
    if (affordabilityError) return NextResponse.json({ error: affordabilityError }, { status: 400 });
  }

  const [decision] = await db
    .insert(decisions)
    .values({
      eventDispatchId,
      teamId: session!.user.teamId,
      submittedByUserId: Number(session!.user.id),
      structuredChoice,
      rationaleText,
      resourceAllocationJson: body.resourceAllocationJson ?? null,
      coordinatedWithTeamsJson: body.coordinatedWithTeamsJson ?? null,
      confidenceLevel,
    })
    .returning();

  await db.update(eventDispatches).set({ status: "responded" }).where(eq(eventDispatches.id, eventDispatchId));

  return NextResponse.json({ decision });
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const dispatchId = searchParams.get("eventDispatchId");

  if (dispatchId) {
    const rows = await db.query.decisions.findMany({ where: eq(decisions.eventDispatchId, Number(dispatchId)) });
    return NextResponse.json({ decisions: rows });
  }

  if (session!.user.role === "instructor") {
    const rows = await db.query.decisions.findMany();
    return NextResponse.json({ decisions: rows });
  }

  const rows = await db.query.decisions.findMany({ where: eq(decisions.teamId, session!.user.teamId!) });
  return NextResponse.json({ decisions: rows });
}
