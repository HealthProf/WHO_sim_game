import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emergencyFundingRequests, emergencyFundingContributions, sessionState, teams } from "@/lib/db/schema";
import { and, eq, inArray, asc } from "drizzle-orm";
import { requireInstructorActor } from "@/lib/session-context";
import { closeEmergencyRequest } from "@/lib/facilitator-actions";

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

  const body = await req.json();
  const result = await closeEmergencyRequest(actor!.sessionId, Number(body.requestId), actor!.userId!);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, totalContributed: result.totalContributed });
}
