// Facilitator-side economy actions, shared by the facilitator's routes
// (app/api/instructor/market, app/api/instructor/emergency-funding) and the
// solo-mode computer facilitator (lib/computer-facilitator.ts), so a computer
// approval behaves exactly like a human one. Moved here unchanged in
// Release 3; every query is session-scoped, every balance change uses the
// atomic helpers in lib/db-atomic.ts, and each row is claimed with a guarded
// status update before money moves (no db.transaction() on neon-http).
import { db } from "./db";
import {
  marketRequests,
  modelState,
  teams,
  teamNotifications,
  globalFeedItems,
  modelStateHistory,
  instructorActions,
  emergencyFundingRequests,
  emergencyFundingContributions,
} from "./db/schema";
import { and, eq } from "drizzle-orm";
import { tryDeductRegionField, creditRegionField, tryDeductWhoHqField, creditWhoHqField } from "./db-atomic";

export type ActionResult = { ok: true; totalContributed?: number } | { ok: false; status: number; error: string };

export async function resolveMarketRequest(sessionId: string, requestId: number, action: "approve" | "reject", actorUserId: number): Promise<ActionResult> {
  const request = await db.query.marketRequests.findFirst({ where: and(eq(marketRequests.sessionId, sessionId), eq(marketRequests.id, requestId)) });
  if (!request || request.status !== "pending") return { ok: false, status: 404, error: "Request not found or already resolved" };

  const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.id, request.teamId)) });
  if (!team) return { ok: false, status: 404, error: "Region not found" };
  const label = request.resourceType === "PPE_DAYS" ? "PPE-days" : "antiviral doses";

  if (action === "reject") {
    const rejected = await db
      .update(marketRequests)
      .set({ status: "rejected", resolvedAt: new Date(), resolvedByUserId: actorUserId })
      .where(and(eq(marketRequests.sessionId, sessionId), eq(marketRequests.id, requestId), eq(marketRequests.status, "pending")))
      .returning();
    if (rejected.length === 0) return { ok: false, status: 409, error: "Request was already resolved or cancelled" };
    await db.insert(teamNotifications).values({ sessionId, teamId: team.id, kind: "market", message: `WHO HQ declined your request for ${request.amount.toLocaleString()} ${label}.` });
    return { ok: true };
  }

  const claimed = await db
    .update(marketRequests)
    .set({ status: "approved", resolvedAt: new Date(), resolvedByUserId: actorUserId })
    .where(and(eq(marketRequests.sessionId, sessionId), eq(marketRequests.id, requestId), eq(marketRequests.status, "pending")))
    .returning();
  if (claimed.length === 0) return { ok: false, status: 409, error: "Request was already resolved by someone else" };

  const stockField = request.resourceType === "PPE_DAYS" ? "whoHqPpeStock" : "whoHqAntiviralsStock";
  const regionResourceField = request.resourceType === "PPE_DAYS" ? "ppeDaysRemaining" : "antiviralsRemaining";

  const stockDeducted = await tryDeductWhoHqField(sessionId, stockField, request.amount);
  if (!stockDeducted) {
    await db.update(marketRequests).set({ status: "rejected" }).where(and(eq(marketRequests.sessionId, sessionId), eq(marketRequests.id, requestId)));
    await db.insert(teamNotifications).values({ sessionId, teamId: team.id, kind: "market", message: `WHO HQ no longer has enough ${label} to fill your request — it's been declined.` });
    return { ok: false, status: 400, error: "WHO HQ no longer has enough stock to fill this request." };
  }

  const fundDeducted = await tryDeductRegionField(sessionId, team.regionId, "fundRemaining", request.totalCost);
  if (!fundDeducted) {
    await creditWhoHqField(sessionId, stockField, request.amount); // compensate the stock deduction above
    await db.update(marketRequests).set({ status: "rejected" }).where(and(eq(marketRequests.sessionId, sessionId), eq(marketRequests.id, requestId)));
    await db.insert(teamNotifications).values({ sessionId, teamId: team.id, kind: "market", message: `Your region no longer has enough funds for this request — it's been declined.` });
    return { ok: false, status: 400, error: `${team.regionId} no longer has enough funds for this request.` };
  }

  await creditRegionField(sessionId, team.regionId, regionResourceField, request.amount);

  const updated = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, team.regionId)) });
  const headline = `WHO HQ sale approved: ${team.regionId} purchased ${request.amount.toLocaleString()} ${label} for $${request.totalCost.toLocaleString()}.`;
  if (updated) await db.insert(modelStateHistory).values({ sessionId, regionId: team.regionId, day: updated.day, snapshotJson: updated, reason: headline });
  await db.insert(globalFeedItems).values({ sessionId, headlineText: headline });
  const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });
  await db.insert(teamNotifications).values(allTeams.map((t) => ({ sessionId, teamId: t.id, kind: "market", message: headline })));
  await db.insert(instructorActions).values({ sessionId, instructorUserId: actorUserId, actionType: "market_sale_approved", targetDesc: headline });
  return { ok: true };
}

// Close an open emergency funding request: whatever has been contributed is
// paid to the requester.
export async function closeEmergencyRequest(sessionId: string, requestId: number, actorUserId: number): Promise<ActionResult> {
  const request = await db.query.emergencyFundingRequests.findFirst({
    where: and(eq(emergencyFundingRequests.sessionId, sessionId), eq(emergencyFundingRequests.id, requestId)),
  });
  if (!request || request.status !== "open") return { ok: false, status: 404, error: "Request not found or already closed" };

  const requestingTeam = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.id, request.requestingTeamId)) });
  if (!requestingTeam) return { ok: false, status: 404, error: "Region not found" };

  const claimed = await db
    .update(emergencyFundingRequests)
    .set({ status: "closed", closedAt: new Date() })
    .where(and(eq(emergencyFundingRequests.sessionId, sessionId), eq(emergencyFundingRequests.id, requestId), eq(emergencyFundingRequests.status, "open")))
    .returning();
  if (claimed.length === 0) return { ok: false, status: 409, error: "Request was already closed" };

  const contributions = await db.query.emergencyFundingContributions.findMany({
    where: and(eq(emergencyFundingContributions.sessionId, sessionId), eq(emergencyFundingContributions.requestId, requestId)),
  });
  const totalContributed = contributions.reduce((sum, c) => sum + c.amount, 0);
  await creditRegionField(sessionId, requestingTeam.regionId, "fundRemaining", totalContributed);

  const headline = `Emergency funding closed: ${requestingTeam.regionId} requested $${request.amountRequested.toLocaleString()}, received $${totalContributed.toLocaleString()} from ${contributions.length} contributor${contributions.length === 1 ? "" : "s"}.`;
  const updated = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, requestingTeam.regionId)) });
  if (updated) await db.insert(modelStateHistory).values({ sessionId, regionId: requestingTeam.regionId, day: updated.day, snapshotJson: updated, reason: headline });
  await db.insert(globalFeedItems).values({ sessionId, headlineText: headline });
  const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });
  await db.insert(teamNotifications).values(allTeams.map((t) => ({ sessionId, teamId: t.id, kind: "emergency_funding", message: headline })));
  await db.insert(instructorActions).values({ sessionId, instructorUserId: actorUserId, actionType: "emergency_funding_closed", targetDesc: headline });
  return { ok: true, totalContributed };
}

// A contribution to an open request, from WHO HQ (contributorTeamId null) or
// a region. Same order as app/api/emergency-funding PATCH: the unique
// contribution row first (one per party), then the atomic debit, removing the
// row if the debit fails.
export async function contributeToRequest(
  sessionId: string,
  requestId: number,
  amount: number,
  from: { whoHq: true } | { whoHq: false; teamId: number; regionId: string }
): Promise<boolean> {
  let inserted;
  try {
    [inserted] = await db
      .insert(emergencyFundingContributions)
      .values({ sessionId, requestId, contributorTeamId: from.whoHq ? null : from.teamId, isWhoHq: from.whoHq, amount })
      .returning();
  } catch {
    return false; // already contributed
  }
  const ok = from.whoHq
    ? await tryDeductWhoHqField(sessionId, "whoHqFund", amount)
    : await tryDeductRegionField(sessionId, from.regionId, "fundRemaining", amount);
  if (!ok) {
    await db.delete(emergencyFundingContributions).where(eq(emergencyFundingContributions.id, inserted.id));
    return false;
  }
  // Same guard as the HTTP route: if the requester cancelled in the same
  // instant, nobody will ever pay this out, so refund it.
  const still = await db.query.emergencyFundingRequests.findFirst({
    where: and(eq(emergencyFundingRequests.sessionId, sessionId), eq(emergencyFundingRequests.id, requestId)),
  });
  if (still?.status === "cancelled") {
    if (from.whoHq) await creditWhoHqField(sessionId, "whoHqFund", amount);
    else await creditRegionField(sessionId, from.regionId, "fundRemaining", amount);
    await db.delete(emergencyFundingContributions).where(eq(emergencyFundingContributions.id, inserted.id));
    return false;
  }
  return true;
}
