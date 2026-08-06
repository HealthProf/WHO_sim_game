import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { budgetCycles, budgetCycleResponses, budgetCycleDonations, regions, teams } from "@/lib/db/schema";
import { and, eq, ne, desc } from "drizzle-orm";
import { requireActor, requireTeamActor } from "@/lib/session-context";
import { defaultAmountForRegion, submitBudgetResponse, submitDonation } from "@/lib/budget-cycle";

// GET: the current (non-closed) budget cycle, if any, plus the requesting
// team's own default amount and whether they've already responded/donated —
// enough for the team UI to know exactly what state it's in.
export async function GET() {
  const { actor, error } = await requireActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const cycle = await db.query.budgetCycles.findFirst({
    where: and(eq(budgetCycles.sessionId, sessionId), ne(budgetCycles.status, "closed")),
    orderBy: desc(budgetCycles.id),
  });
  if (!cycle) return NextResponse.json({ cycle: null });

  const responses = await db.query.budgetCycleResponses.findMany({
    where: and(eq(budgetCycleResponses.sessionId, sessionId), eq(budgetCycleResponses.budgetCycleId, cycle.id)),
  });
  const donations = await db.query.budgetCycleDonations.findMany({
    where: and(eq(budgetCycleDonations.sessionId, sessionId), eq(budgetCycleDonations.budgetCycleId, cycle.id)),
  });
  const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });

  let myDefaultAmount: number | null = null;
  let myResponse: { choice: string; requestedAmount: number | null } | null = null;
  let myDonation: number | null = null;
  if (actor!.teamId) {
    const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.id, actor!.teamId)) });
    const region = team ? await db.query.regions.findFirst({ where: eq(regions.id, team.regionId) }) : null;
    if (region) myDefaultAmount = defaultAmountForRegion(region.startingFund);
    const mine = responses.find((r) => r.teamId === actor!.teamId);
    if (mine) myResponse = { choice: mine.choice, requestedAmount: mine.requestedAmount };
    const myDon = donations.find((d) => d.fromTeamId === actor!.teamId);
    if (myDon) myDonation = myDon.amount;
  }

  const requesters = responses
    .filter((r) => r.choice === "request_more")
    .map((r) => ({ regionId: allTeams.find((t) => t.id === r.teamId)?.regionId ?? "?", requestedAmount: r.requestedAmount }));

  return NextResponse.json({
    cycle: {
      id: cycle.id,
      cycleNumber: cycle.cycleNumber,
      status: cycle.status,
      mode: cycle.mode,
      closesAt: cycle.closesAt,
    },
    myDefaultAmount,
    myResponse,
    myDonation,
    respondedCount: responses.length,
    totalTeams: allTeams.length,
    requesters,
  });
}

// POST: team submits its response (accept/request_more) during the
// collecting_responses phase, or a donation during collecting_donations.
export async function POST(req: NextRequest) {
  const { actor, error } = await requireTeamActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json();
  const action = body.action as "respond" | "donate";
  const cycleId = Number(body.cycleId);

  const cycle = await db.query.budgetCycles.findFirst({ where: and(eq(budgetCycles.sessionId, sessionId), eq(budgetCycles.id, cycleId)) });
  if (!cycle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    if (action === "respond") {
      const choice = body.choice as "accept" | "request_more";
      const requestedAmount = choice === "request_more" ? Math.round(Number(body.requestedAmount)) : undefined;
      if (choice === "request_more" && (!Number.isFinite(requestedAmount) || (requestedAmount ?? 0) <= 0)) {
        return NextResponse.json({ error: "Requested amount must be a positive number" }, { status: 400 });
      }
      await submitBudgetResponse(sessionId, cycleId, actor!.teamId!, choice, requestedAmount);
    } else if (action === "donate") {
      const amount = Math.round(Number(body.amount));
      if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: "Amount must be zero or a positive number" }, { status: 400 });
      await submitDonation(sessionId, cycleId, actor!.teamId!, amount);
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
