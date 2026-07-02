import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emergencyFundingRequests, emergencyFundingContributions, modelState, globalState, teams, teamNotifications, globalFeedItems, modelStateHistory, instructorActions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireInstructor } from "@/lib/api-helpers";

// GET: WHO HQ's own (non-resupplied) fund balance plus every open emergency
// funding request, for the instructor's Control page panel.
export async function GET() {
  const { error } = await requireInstructor();
  if (error) return error;

  const gs = await db.query.globalState.findFirst({ where: eq(globalState.id, 1) });
  const openRequests = await db.query.emergencyFundingRequests.findMany({
    where: eq(emergencyFundingRequests.status, "open"),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });
  const allTeams = await db.query.teams.findMany();
  const enriched = await Promise.all(
    openRequests.map(async (r) => {
      const contributions = await db.query.emergencyFundingContributions.findMany({ where: eq(emergencyFundingContributions.requestId, r.id) });
      const totalContributed = contributions.reduce((sum, c) => sum + c.amount, 0);
      const whoHqContributed = contributions.some((c) => c.isWhoHq);
      return {
        ...r,
        requestingRegionId: allTeams.find((t) => t.id === r.requestingTeamId)?.regionId ?? "?",
        totalContributed,
        whoHqContributed,
      };
    })
  );

  return NextResponse.json({ whoHqFund: gs?.whoHqFund ?? 0, requests: enriched });
}

// PATCH: instructor closes an open emergency funding request — whatever's
// been contributed so far (from regions and/or WHO HQ) is transferred to the
// requester and the request is marked closed. The instructor decides when
// enough time/contribution has happened; there's no hard timer here.
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireInstructor();
  if (error) return error;

  const body = await req.json();
  const requestId = Number(body.requestId);

  const request = await db.query.emergencyFundingRequests.findFirst({ where: eq(emergencyFundingRequests.id, requestId) });
  if (!request || request.status !== "open") return NextResponse.json({ error: "Request not found or already closed" }, { status: 404 });

  const contributions = await db.query.emergencyFundingContributions.findMany({ where: eq(emergencyFundingContributions.requestId, requestId) });
  const totalContributed = contributions.reduce((sum, c) => sum + c.amount, 0);

  const requestingTeam = await db.query.teams.findFirst({ where: eq(teams.id, request.requestingTeamId) });
  if (!requestingTeam) return NextResponse.json({ error: "Region not found" }, { status: 404 });

  const state = await db.query.modelState.findFirst({ where: eq(modelState.regionId, requestingTeam.regionId) });
  if (state) {
    await db.update(modelState).set({ fundRemaining: state.fundRemaining + totalContributed, updatedAt: new Date() }).where(eq(modelState.regionId, requestingTeam.regionId));
  }
  await db.update(emergencyFundingRequests).set({ status: "closed", closedAt: new Date() }).where(eq(emergencyFundingRequests.id, requestId));

  const headline = `Emergency funding closed: ${requestingTeam.regionId} requested $${request.amountRequested.toLocaleString()}, received $${totalContributed.toLocaleString()} from ${contributions.length} contributor${contributions.length === 1 ? "" : "s"}.`;
  const updated = await db.query.modelState.findFirst({ where: eq(modelState.regionId, requestingTeam.regionId) });
  if (updated) await db.insert(modelStateHistory).values({ regionId: requestingTeam.regionId, day: updated.day, snapshotJson: updated, reason: headline });
  await db.insert(globalFeedItems).values({ headlineText: headline });
  const allTeams = await db.query.teams.findMany();
  for (const t of allTeams) {
    await db.insert(teamNotifications).values({ teamId: t.id, kind: "emergency_funding", message: headline });
  }
  await db.insert(instructorActions).values({ instructorUserId: Number(session!.user.id), actionType: "emergency_funding_closed", targetDesc: headline });

  return NextResponse.json({ ok: true, totalContributed });
}
