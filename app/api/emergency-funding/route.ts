import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emergencyFundingRequests, emergencyFundingContributions, modelState, teams, teamNotifications } from "@/lib/db/schema";
import { and, eq, inArray, desc } from "drizzle-orm";
import { requireActor, requireTeamActor } from "@/lib/session-context";
import { POLITICAL_TENSION_LOCKOUT_THRESHOLD } from "@/lib/config";
import { tryDeductRegionField, tryDeductWhoHqField } from "@/lib/db-atomic";
import { logAnalyticsEvent } from "@/lib/analytics";

// GET: all emergency funding requests (open + recently closed) with their
// contributions so far — visible to everyone, same transparency model as
// pledges/coordination.
export async function GET() {
  const { actor, error } = await requireActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const requests = await db.query.emergencyFundingRequests.findMany({
    where: eq(emergencyFundingRequests.sessionId, sessionId),
    orderBy: desc(emergencyFundingRequests.createdAt),
    limit: 20,
  });
  const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });
  const allContributions = requests.length
    ? await db.query.emergencyFundingContributions.findMany({
        where: and(eq(emergencyFundingContributions.sessionId, sessionId), inArray(emergencyFundingContributions.requestId, requests.map((r) => r.id))),
      })
    : [];

  const enriched = requests.map((r) => {
    const contributions = allContributions.filter((c) => c.requestId === r.id);
    const totalContributed = contributions.reduce((sum, c) => sum + c.amount, 0);
    return {
      ...r,
      requestingRegionId: allTeams.find((t) => t.id === r.requestingTeamId)?.regionId ?? "?",
      totalContributed,
      contributions: contributions.map((c) => ({
        ...c,
        regionId: c.isWhoHq ? "WHO HQ" : allTeams.find((t) => t.id === c.contributorTeamId)?.regionId ?? "?",
      })),
    };
  });

  return NextResponse.json({ requests: enriched });
}

// POST: a team opens a new emergency funding request, broadcast to every
// other region and WHO HQ. Stays open until the instructor closes it (see
// PATCH in app/api/instructor/emergency-funding/route.ts) — facilitator-
// paced rather than a hard timer, since the ask amount and urgency vary a
// lot more than a routine market purchase.
export async function POST(req: NextRequest) {
  const { actor, error } = await requireTeamActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json();
  const amountRequested = Math.round(Number(body.amountRequested));
  const reason = (body.reason as string)?.trim();
  if (!Number.isFinite(amountRequested) || amountRequested <= 0) {
    return NextResponse.json({ error: "Requested amount must be a positive number" }, { status: 400 });
  }
  if (!reason) return NextResponse.json({ error: "A reason is required" }, { status: 400 });

  const existingOpen = await db.query.emergencyFundingRequests.findFirst({
    where: and(eq(emergencyFundingRequests.sessionId, sessionId), eq(emergencyFundingRequests.requestingTeamId, actor!.teamId!), eq(emergencyFundingRequests.status, "open")),
  });
  if (existingOpen) return NextResponse.json({ error: "Your region already has an open emergency funding request." }, { status: 409 });

  const requestingTeam = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.id, actor!.teamId!)) });
  const requesterState = requestingTeam
    ? await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, requestingTeam.regionId)) })
    : null;
  if (requesterState && requesterState.politicalTensionIndex >= POLITICAL_TENSION_LOCKOUT_THRESHOLD) {
    return NextResponse.json(
      { error: `Cooperation with WHO HQ is currently ruptured (political tension ${requesterState.politicalTensionIndex}/100) — resolve EVT-025 before requesting emergency funding.` },
      { status: 403 }
    );
  }

  const [request] = await db
    .insert(emergencyFundingRequests)
    .values({ sessionId, requestingTeamId: actor!.teamId!, amountRequested, reason })
    .returning();

  const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });
  const otherTeams = allTeams.filter((t) => t.id !== actor!.teamId);
  if (otherTeams.length > 0) {
    await db.insert(teamNotifications).values(
      otherTeams.map((t) => ({
        sessionId,
        teamId: t.id,
        kind: "emergency_funding",
        message: `${requestingTeam?.regionId} has requested $${amountRequested.toLocaleString()} in emergency funding: "${reason}." Visit Emergency Funding to contribute.`,
      }))
    );
  }

  await logAnalyticsEvent({
    sessionId,
    mode: actor!.mode,
    eventType: "emergency_funding_requested",
    actorRole: actor!.role,
    regionId: actor!.regionId,
    userId: actor!.userId,
    metadata: { amountRequested },
  });

  return NextResponse.json({ request });
}

// PATCH (action=contribute): a team, or the instructor acting as WHO HQ,
// pledges an amount toward an open request. Funds move immediately.
export async function PATCH(req: NextRequest) {
  const { actor, error } = await requireActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json();
  const requestId = Number(body.requestId);
  const amount = Math.round(Number(body.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  const request = await db.query.emergencyFundingRequests.findFirst({
    where: and(eq(emergencyFundingRequests.sessionId, sessionId), eq(emergencyFundingRequests.id, requestId)),
  });
  if (!request || request.status !== "open") return NextResponse.json({ error: "Request not found or already closed" }, { status: 404 });

  const isWhoHq = actor!.role === "instructor";
  if (!isWhoHq && !actor!.teamId) return NextResponse.json({ error: "Only teams or the instructor can contribute" }, { status: 403 });
  if (!isWhoHq && actor!.teamId === request.requestingTeamId) {
    return NextResponse.json({ error: "Can't contribute to your own request" }, { status: 400 });
  }

  // Insert the contribution row first — the unique constraint on
  // (sessionId, requestId, contributorTeamId, isWhoHq) is what actually
  // guarantees "at most one contribution per party," atomically, even under
  // concurrent double-clicks. The fund deduction only runs after a
  // successful insert, and is itself an atomic conditional update (see
  // lib/db-atomic.ts); if it fails, the just-inserted row is removed so a
  // failed contribution never leaves a phantom pledge behind.
  let inserted;
  try {
    [inserted] = await db
      .insert(emergencyFundingContributions)
      .values({ sessionId, requestId, contributorTeamId: isWhoHq ? null : actor!.teamId, isWhoHq, amount })
      .returning();
  } catch {
    return NextResponse.json({ error: "You've already contributed to this request." }, { status: 409 });
  }

  if (isWhoHq) {
    const deducted = await tryDeductWhoHqField(sessionId, "whoHqFund", amount);
    if (!deducted) {
      await db.delete(emergencyFundingContributions).where(eq(emergencyFundingContributions.id, inserted.id));
      return NextResponse.json({ error: "WHO HQ doesn't have that much remaining." }, { status: 400 });
    }
  } else {
    const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.id, actor!.teamId!)) });
    if (!team) return NextResponse.json({ error: "Region not found" }, { status: 404 });
    const deducted = await tryDeductRegionField(sessionId, team.regionId, "fundRemaining", amount);
    if (!deducted) {
      await db.delete(emergencyFundingContributions).where(eq(emergencyFundingContributions.id, inserted.id));
      return NextResponse.json({ error: "You don't have that much available." }, { status: 400 });
    }
  }

  await logAnalyticsEvent({
    sessionId,
    mode: actor!.mode,
    eventType: "emergency_funding_contributed",
    actorRole: actor!.role,
    regionId: actor!.regionId,
    userId: actor!.userId,
    metadata: { requestId, amount, isWhoHq },
  });

  return NextResponse.json({ ok: true });
}
