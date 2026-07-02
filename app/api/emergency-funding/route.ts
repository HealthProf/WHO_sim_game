import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { emergencyFundingRequests, emergencyFundingContributions, modelState, teams, teamNotifications } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/api-helpers";
import { POLITICAL_TENSION_LOCKOUT_THRESHOLD } from "@/lib/config";
import { tryDeductRegionField, tryDeductWhoHqField } from "@/lib/db-atomic";

// GET: all emergency funding requests (open + recently closed) with their
// contributions so far — visible to everyone, same transparency model as
// pledges/coordination.
export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const requests = await db.query.emergencyFundingRequests.findMany({ orderBy: (t, { desc }) => [desc(t.createdAt)], limit: 20 });
  const allTeams = await db.query.teams.findMany();
  const allContributions = requests.length
    ? await db.query.emergencyFundingContributions.findMany({ where: inArray(emergencyFundingContributions.requestId, requests.map((r) => r.id)) })
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
  const { session, error } = await requireSession();
  if (error) return error;
  if (session!.user.role !== "student" || !session!.user.teamId) {
    return NextResponse.json({ error: "Only teams can open an emergency funding request" }, { status: 403 });
  }

  const body = await req.json();
  const amountRequested = Math.round(Number(body.amountRequested));
  const reason = (body.reason as string)?.trim();
  if (!Number.isFinite(amountRequested) || amountRequested <= 0) {
    return NextResponse.json({ error: "Requested amount must be a positive number" }, { status: 400 });
  }
  if (!reason) return NextResponse.json({ error: "A reason is required" }, { status: 400 });

  const existingOpen = await db.query.emergencyFundingRequests.findFirst({
    where: (t, { and, eq: eqOp }) => and(eqOp(t.requestingTeamId, session!.user.teamId!), eqOp(t.status, "open")),
  });
  if (existingOpen) return NextResponse.json({ error: "Your region already has an open emergency funding request." }, { status: 409 });

  const requestingTeam = await db.query.teams.findFirst({ where: eq(teams.id, session!.user.teamId) });
  const requesterState = requestingTeam ? await db.query.modelState.findFirst({ where: eq(modelState.regionId, requestingTeam.regionId) }) : null;
  if (requesterState && requesterState.politicalTensionIndex >= POLITICAL_TENSION_LOCKOUT_THRESHOLD) {
    return NextResponse.json(
      { error: `Cooperation with WHO HQ is currently ruptured (political tension ${requesterState.politicalTensionIndex}/100) — resolve EVT-025 before requesting emergency funding.` },
      { status: 403 }
    );
  }

  const [request] = await db
    .insert(emergencyFundingRequests)
    .values({ requestingTeamId: session!.user.teamId, amountRequested, reason })
    .returning();

  const allTeams = await db.query.teams.findMany();
  const otherTeams = allTeams.filter((t) => t.id !== session!.user.teamId);
  if (otherTeams.length > 0) {
    await db.insert(teamNotifications).values(
      otherTeams.map((t) => ({
        teamId: t.id,
        kind: "emergency_funding",
        message: `${requestingTeam?.regionId} has requested $${amountRequested.toLocaleString()} in emergency funding: "${reason}." Visit Emergency Funding to contribute.`,
      }))
    );
  }

  return NextResponse.json({ request });
}

// PATCH (action=contribute): a team, or the instructor acting as WHO HQ,
// pledges an amount toward an open request. Funds move immediately.
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = await req.json();
  const requestId = Number(body.requestId);
  const amount = Math.round(Number(body.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  const request = await db.query.emergencyFundingRequests.findFirst({ where: eq(emergencyFundingRequests.id, requestId) });
  if (!request || request.status !== "open") return NextResponse.json({ error: "Request not found or already closed" }, { status: 404 });

  const isWhoHq = session!.user.role === "instructor";
  if (!isWhoHq && !session!.user.teamId) return NextResponse.json({ error: "Only teams or the instructor can contribute" }, { status: 403 });
  if (!isWhoHq && session!.user.teamId === request.requestingTeamId) {
    return NextResponse.json({ error: "Can't contribute to your own request" }, { status: 400 });
  }

  // Insert the contribution row first — the unique constraint on
  // (requestId, contributorTeamId, isWhoHq) is what actually guarantees
  // "at most one contribution per party," atomically, even under
  // concurrent double-clicks. The fund deduction only runs after a
  // successful insert, and is itself an atomic conditional update (see
  // lib/db-atomic.ts); if it fails, the just-inserted row is removed so a
  // failed contribution never leaves a phantom pledge behind.
  let inserted;
  try {
    [inserted] = await db
      .insert(emergencyFundingContributions)
      .values({ requestId, contributorTeamId: isWhoHq ? null : session!.user.teamId, isWhoHq, amount })
      .returning();
  } catch {
    return NextResponse.json({ error: "You've already contributed to this request." }, { status: 409 });
  }

  if (isWhoHq) {
    const deducted = await tryDeductWhoHqField("whoHqFund", amount);
    if (!deducted) {
      await db.delete(emergencyFundingContributions).where(eq(emergencyFundingContributions.id, inserted.id));
      return NextResponse.json({ error: "WHO HQ doesn't have that much remaining." }, { status: 400 });
    }
  } else {
    const team = await db.query.teams.findFirst({ where: eq(teams.id, session!.user.teamId!) });
    if (!team) return NextResponse.json({ error: "Region not found" }, { status: 404 });
    const deducted = await tryDeductRegionField(team.regionId, "fundRemaining", amount);
    if (!deducted) {
      await db.delete(emergencyFundingContributions).where(eq(emergencyFundingContributions.id, inserted.id));
      return NextResponse.json({ error: "You don't have that much available." }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
