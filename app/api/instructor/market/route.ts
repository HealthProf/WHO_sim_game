import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { marketRequests, modelState, globalState, teams, teamNotifications, globalFeedItems, modelStateHistory, instructorActions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireInstructor } from "@/lib/api-helpers";

// GET: pending WHO HQ purchase requests, for the instructor's approval queue.
export async function GET() {
  const { error } = await requireInstructor();
  if (error) return error;

  const pending = await db.query.marketRequests.findMany({ where: eq(marketRequests.status, "pending"), orderBy: (t, { asc }) => [asc(t.createdAt)] });
  const allTeams = await db.query.teams.findMany();
  return NextResponse.json({ requests: pending.map((r) => ({ ...r, regionId: allTeams.find((t) => t.id === r.teamId)?.regionId ?? "?" })) });
}

// PATCH: approve or reject a pending request. Approving requires WHO HQ to
// still have enough stock (it may have sold out to an earlier request in the
// same batch) and deducts the requesting region's fund / credits its
// resource; the "sale" is then a first-class public announcement (item 3 —
// "final sales from WHO HQ are pop-up displayed to everyone").
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireInstructor();
  if (error) return error;

  const body = await req.json();
  const requestId = Number(body.requestId);
  const action = body.action as "approve" | "reject";

  const request = await db.query.marketRequests.findFirst({ where: eq(marketRequests.id, requestId) });
  if (!request || request.status !== "pending") return NextResponse.json({ error: "Request not found or already resolved" }, { status: 404 });

  const team = await db.query.teams.findFirst({ where: eq(teams.id, request.teamId) });
  if (!team) return NextResponse.json({ error: "Region not found" }, { status: 404 });

  if (action === "reject") {
    await db.update(marketRequests).set({ status: "rejected", resolvedAt: new Date(), resolvedByUserId: Number(session!.user.id) }).where(eq(marketRequests.id, requestId));
    await db.insert(teamNotifications).values({ teamId: team.id, kind: "market", message: `WHO HQ declined your request for ${request.amount.toLocaleString()} ${request.resourceType === "PPE_DAYS" ? "PPE-days" : "antiviral doses"}.` });
    return NextResponse.json({ ok: true });
  }

  const gs = await db.query.globalState.findFirst({ where: eq(globalState.id, 1) });
  const state = await db.query.modelState.findFirst({ where: eq(modelState.regionId, team.regionId) });
  if (!gs || !state) return NextResponse.json({ error: "State not found" }, { status: 500 });

  const stockField = request.resourceType === "PPE_DAYS" ? "whoHqPpeStock" : "whoHqAntiviralsStock";
  const currentStock = gs[stockField];
  if (currentStock < request.amount) {
    return NextResponse.json({ error: `WHO HQ only has ${currentStock.toLocaleString()} left — not enough to fill this request.` }, { status: 400 });
  }
  if (state.fundRemaining < request.totalCost) {
    return NextResponse.json({ error: `${team.regionId} no longer has enough funds ($${state.fundRemaining.toLocaleString()} available, needs $${request.totalCost.toLocaleString()}).` }, { status: 400 });
  }

  const regionResourceField = request.resourceType === "PPE_DAYS" ? "ppeDaysRemaining" : "antiviralsRemaining";
  await db
    .update(modelState)
    .set({ fundRemaining: state.fundRemaining - request.totalCost, [regionResourceField]: state[regionResourceField] + request.amount, updatedAt: new Date() } as never)
    .where(eq(modelState.regionId, team.regionId));
  await db.update(globalState).set({ [stockField]: currentStock - request.amount, updatedAt: new Date() } as never).where(eq(globalState.id, 1));
  await db.update(marketRequests).set({ status: "approved", resolvedAt: new Date(), resolvedByUserId: Number(session!.user.id) }).where(eq(marketRequests.id, requestId));

  const updated = await db.query.modelState.findFirst({ where: eq(modelState.regionId, team.regionId) });
  const label = request.resourceType === "PPE_DAYS" ? "PPE-days" : "antiviral doses";
  const headline = `WHO HQ sale approved: ${team.regionId} purchased ${request.amount.toLocaleString()} ${label} for $${request.totalCost.toLocaleString()}.`;
  if (updated) await db.insert(modelStateHistory).values({ regionId: team.regionId, day: updated.day, snapshotJson: updated, reason: headline });
  await db.insert(globalFeedItems).values({ headlineText: headline });
  const allTeams = await db.query.teams.findMany();
  for (const t of allTeams) {
    await db.insert(teamNotifications).values({ teamId: t.id, kind: "market", message: headline });
  }
  await db.insert(instructorActions).values({ instructorUserId: Number(session!.user.id), actionType: "market_sale_approved", targetDesc: headline });

  return NextResponse.json({ ok: true });
}
