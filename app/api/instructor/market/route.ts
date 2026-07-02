import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { marketRequests, modelState, teams, teamNotifications, globalFeedItems, modelStateHistory, instructorActions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireInstructor } from "@/lib/api-helpers";
import { tryDeductRegionField, creditRegionField, tryDeductWhoHqField, creditWhoHqField } from "@/lib/db-atomic";

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
//
// Every balance change is an atomic single-statement conditional update
// (see lib/db-atomic.ts for why, given this app's driver can't use
// db.transaction() in production). The request row is claimed first
// (pending -> approved, guarded by status='pending' in the WHERE clause) so
// two concurrent approve clicks on the same request can't both succeed;
// if a later step then fails, the claim is compensated back to "rejected"
// rather than left in a half-applied "approved but never fulfilled" state.
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

  const claimed = await db
    .update(marketRequests)
    .set({ status: "approved", resolvedAt: new Date(), resolvedByUserId: Number(session!.user.id) })
    .where(and(eq(marketRequests.id, requestId), eq(marketRequests.status, "pending")))
    .returning();
  if (claimed.length === 0) return NextResponse.json({ error: "Request was already resolved by someone else" }, { status: 409 });

  const stockField = request.resourceType === "PPE_DAYS" ? "whoHqPpeStock" : "whoHqAntiviralsStock";
  const regionResourceField = request.resourceType === "PPE_DAYS" ? "ppeDaysRemaining" : "antiviralsRemaining";

  const stockDeducted = await tryDeductWhoHqField(stockField, request.amount);
  if (!stockDeducted) {
    await db.update(marketRequests).set({ status: "rejected" }).where(eq(marketRequests.id, requestId));
    await db.insert(teamNotifications).values({ teamId: team.id, kind: "market", message: `WHO HQ no longer has enough ${request.resourceType === "PPE_DAYS" ? "PPE-days" : "antiviral doses"} to fill your request — it's been declined.` });
    return NextResponse.json({ error: "WHO HQ no longer has enough stock to fill this request." }, { status: 400 });
  }

  const fundDeducted = await tryDeductRegionField(team.regionId, "fundRemaining", request.totalCost);
  if (!fundDeducted) {
    await creditWhoHqField(stockField, request.amount); // compensate the stock deduction above
    await db.update(marketRequests).set({ status: "rejected" }).where(eq(marketRequests.id, requestId));
    await db.insert(teamNotifications).values({ teamId: team.id, kind: "market", message: `Your region no longer has enough funds for this request — it's been declined.` });
    return NextResponse.json({ error: `${team.regionId} no longer has enough funds for this request.` }, { status: 400 });
  }

  await creditRegionField(team.regionId, regionResourceField, request.amount);

  const updated = await db.query.modelState.findFirst({ where: eq(modelState.regionId, team.regionId) });
  const label = request.resourceType === "PPE_DAYS" ? "PPE-days" : "antiviral doses";
  const headline = `WHO HQ sale approved: ${team.regionId} purchased ${request.amount.toLocaleString()} ${label} for $${request.totalCost.toLocaleString()}.`;
  if (updated) await db.insert(modelStateHistory).values({ regionId: team.regionId, day: updated.day, snapshotJson: updated, reason: headline });
  await db.insert(globalFeedItems).values({ headlineText: headline });
  const allTeams = await db.query.teams.findMany();
  await db.insert(teamNotifications).values(allTeams.map((t) => ({ teamId: t.id, kind: "market", message: headline })));
  await db.insert(instructorActions).values({ instructorUserId: Number(session!.user.id), actionType: "market_sale_approved", targetDesc: headline });

  return NextResponse.json({ ok: true });
}
