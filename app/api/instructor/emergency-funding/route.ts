import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emergencyFundingRequests, emergencyFundingContributions, modelState, sessionState, teams, teamNotifications, globalFeedItems, modelStateHistory, instructorActions } from "@/lib/db/schema";
import { and, eq, inArray, asc } from "drizzle-orm";
import { requireInstructorActor } from "@/lib/session-context";
import { creditRegionField } from "@/lib/db-atomic";

// GET: WHO HQ's own (non-resupplied) fund balance plus every open emergency
// funding request, for the instructor's Control page panel.
export async function GET() {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  const openRequests = await db.query.emergencyFundingRequests.findMany({
    where: and(eq(emergencyFundingRequests.sessionId, sessionId), eq(emergencyFundingRequests.status, "open")),
    orderBy: asc(emergencyFundingRequests.createdAt),
  });
  const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });
  const allContributions = openRequests.length
    ? await db.query.emergencyFundingContributions.findMany({
        where: and(eq(emergencyFundingContributions.sessionId, sessionId), inArray(emergencyFundingContributions.requestId, openRequests.map((r) => r.id))),
      })
    : [];
  const enriched = openRequests.map((r) => {
    const contributions = allContributions.filter((c) => c.requestId === r.id);
    const totalContributed = contributions.reduce((sum, c) => sum + c.amount, 0);
    const whoHqContributed = contributions.some((c) => c.isWhoHq);
    return {
      ...r,
      requestingRegionId: allTeams.find((t) => t.id === r.requestingTeamId)?.regionId ?? "?",
      totalContributed,
      whoHqContributed,
    };
  });

  return NextResponse.json({ whoHqFund: gs?.whoHqFund ?? 0, requests: enriched });
}

// PATCH: instructor closes an open emergency funding request — whatever's
// been contributed so far (from regions and/or WHO HQ) is transferred to the
// requester and the request is marked closed. The instructor decides when
// enough time/contribution has happened; there's no hard timer here.
export async function PATCH(req: NextRequest) {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json();
  const requestId = Number(body.requestId);

  const request = await db.query.emergencyFundingRequests.findFirst({
    where: and(eq(emergencyFundingRequests.sessionId, sessionId), eq(emergencyFundingRequests.id, requestId)),
  });
  if (!request || request.status !== "open") return NextResponse.json({ error: "Request not found or already closed" }, { status: 404 });

  const requestingTeam = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.id, request.requestingTeamId)) });
  if (!requestingTeam) return NextResponse.json({ error: "Region not found" }, { status: 404 });

  // Claim the request first (guarded by status='open') so two concurrent
  // "close" clicks can't both credit the region.
  const claimed = await db
    .update(emergencyFundingRequests)
    .set({ status: "closed", closedAt: new Date() })
    .where(and(eq(emergencyFundingRequests.id, requestId), eq(emergencyFundingRequests.status, "open")))
    .returning();
  if (claimed.length === 0) return NextResponse.json({ error: "Request was already closed" }, { status: 409 });

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
  await db.insert(instructorActions).values({ sessionId, instructorUserId: actor!.userId!, actionType: "emergency_funding_closed", targetDesc: headline });

  return NextResponse.json({ ok: true, totalContributed });
}
