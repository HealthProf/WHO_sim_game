import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { marketRequests, modelState, teams, teamNotifications, globalFeedItems, modelStateHistory, instructorActions } from "@/lib/db/schema";
import { and, eq, asc } from "drizzle-orm";
import { requireInstructorActor } from "@/lib/session-context";
import { tryDeductRegionField, creditRegionField, tryDeductWhoHqField, creditWhoHqField } from "@/lib/db-atomic";

// GET: pending WHO HQ purchase requests, for the instructor's approval queue.
export async function GET() {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const pending = await db.query.marketRequests.findMany({
    where: and(eq(marketRequests.sessionId, sessionId), eq(marketRequests.status, "pending")),
    orderBy: asc(marketRequests.createdAt),
  });
  const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });
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
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json();
  const requestId = Number(body.requestId);
  const action = body.action as "approve" | "reject";

  const request = await db.query.marketRequests.findFirst({ where: and(eq(marketRequests.sessionId, sessionId), eq(marketRequests.id, requestId)) });
  if (!request || request.status !== "pending") return NextResponse.json({ error: "Request not found or already resolved" }, { status: 404 });

  const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.id, request.teamId)) });
  if (!team) return NextResponse.json({ error: "Region not found" }, { status: 404 });

  if (action === "reject") {
    await db.update(marketRequests).set({ status: "rejected", resolvedAt: new Date(), resolvedByUserId: actor!.userId! }).where(eq(marketRequests.id, requestId));
    await db.insert(teamNotifications).values({ sessionId, teamId: team.id, kind: "market", message: `WHO HQ declined your request for ${request.amount.toLocaleString()} ${request.resourceType === "PPE_DAYS" ? "PPE-days" : "antiviral doses"}.` });
    return NextResponse.json({ ok: true });
  }

  const claimed = await db
    .update(marketRequests)
    .set({ status: "approved", resolvedAt: new Date(), resolvedByUserId: actor!.userId! })
    .where(and(eq(marketRequests.id, requestId), eq(marketRequests.status, "pending")))
    .returning();
  if (claimed.length === 0) return NextResponse.json({ error: "Request was already resolved by someone else" }, { status: 409 });

  const stockField = request.resourceType === "PPE_DAYS" ? "whoHqPpeStock" : "whoHqAntiviralsStock";
  const regionResourceField = request.resourceType === "PPE_DAYS" ? "ppeDaysRemaining" : "antiviralsRemaining";

  const stockDeducted = await tryDeductWhoHqField(sessionId, stockField, request.amount);
  if (!stockDeducted) {
    await db.update(marketRequests).set({ status: "rejected" }).where(eq(marketRequests.id, requestId));
    await db.insert(teamNotifications).values({ sessionId, teamId: team.id, kind: "market", message: `WHO HQ no longer has enough ${request.resourceType === "PPE_DAYS" ? "PPE-days" : "antiviral doses"} to fill your request — it's been declined.` });
    return NextResponse.json({ error: "WHO HQ no longer has enough stock to fill this request." }, { status: 400 });
  }

  const fundDeducted = await tryDeductRegionField(sessionId, team.regionId, "fundRemaining", request.totalCost);
  if (!fundDeducted) {
    await creditWhoHqField(sessionId, stockField, request.amount); // compensate the stock deduction above
    await db.update(marketRequests).set({ status: "rejected" }).where(eq(marketRequests.id, requestId));
    await db.insert(teamNotifications).values({ sessionId, teamId: team.id, kind: "market", message: `Your region no longer has enough funds for this request — it's been declined.` });
    return NextResponse.json({ error: `${team.regionId} no longer has enough funds for this request.` }, { status: 400 });
  }

  await creditRegionField(sessionId, team.regionId, regionResourceField, request.amount);

  const updated = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, team.regionId)) });
  const label = request.resourceType === "PPE_DAYS" ? "PPE-days" : "antiviral doses";
  const headline = `WHO HQ sale approved: ${team.regionId} purchased ${request.amount.toLocaleString()} ${label} for $${request.totalCost.toLocaleString()}.`;
  if (updated) await db.insert(modelStateHistory).values({ sessionId, regionId: team.regionId, day: updated.day, snapshotJson: updated, reason: headline });
  await db.insert(globalFeedItems).values({ sessionId, headlineText: headline });
  const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });
  await db.insert(teamNotifications).values(allTeams.map((t) => ({ sessionId, teamId: t.id, kind: "market", message: headline })));
  await db.insert(instructorActions).values({ sessionId, instructorUserId: actor!.userId!, actionType: "market_sale_approved", targetDesc: headline });

  return NextResponse.json({ ok: true });
}
