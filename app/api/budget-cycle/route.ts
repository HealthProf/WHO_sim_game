import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { budgetCycleResponses, budgetCycleDonations, regions, teams } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/api-helpers";
import { defaultAmountForRegion, submitBudgetResponse, submitDonation } from "@/lib/budget-cycle";

// GET: the current (non-closed) budget cycle, if any, plus the requesting
// team's own default amount and whether they've already responded/donated —
// enough for the team UI to know exactly what state it's in.
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const cycle = await db.query.budgetCycles.findFirst({ where: (t, { ne }) => ne(t.status, "closed"), orderBy: (t, { desc }) => [desc(t.id)] });
  if (!cycle) return NextResponse.json({ cycle: null });

  const responses = await db.query.budgetCycleResponses.findMany({ where: eq(budgetCycleResponses.budgetCycleId, cycle.id) });
  const donations = await db.query.budgetCycleDonations.findMany({ where: eq(budgetCycleDonations.budgetCycleId, cycle.id) });
  const allTeams = await db.query.teams.findMany();

  let myDefaultAmount: number | null = null;
  let myResponse: { choice: string; requestedAmount: number | null } | null = null;
  let myDonation: number | null = null;
  if (session!.user.teamId) {
    const team = await db.query.teams.findFirst({ where: eq(teams.id, session!.user.teamId) });
    const region = team ? await db.query.regions.findFirst({ where: eq(regions.id, team.regionId) }) : null;
    if (region) myDefaultAmount = defaultAmountForRegion(region.startingFund);
    const mine = responses.find((r) => r.teamId === session!.user.teamId);
    if (mine) myResponse = { choice: mine.choice, requestedAmount: mine.requestedAmount };
    const myDon = donations.find((d) => d.fromTeamId === session!.user.teamId);
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
  const { session, error } = await requireSession();
  if (error) return error;
  if (session!.user.role !== "student" || !session!.user.teamId) {
    return NextResponse.json({ error: "Only teams can respond to a budget cycle" }, { status: 403 });
  }

  const body = await req.json();
  const action = body.action as "respond" | "donate";
  const cycleId = Number(body.cycleId);

  try {
    if (action === "respond") {
      const choice = body.choice as "accept" | "request_more";
      const requestedAmount = choice === "request_more" ? Math.round(Number(body.requestedAmount)) : undefined;
      if (choice === "request_more" && (!Number.isFinite(requestedAmount) || (requestedAmount ?? 0) <= 0)) {
        return NextResponse.json({ error: "Requested amount must be a positive number" }, { status: 400 });
      }
      await submitBudgetResponse(cycleId, session!.user.teamId, choice, requestedAmount);
    } else if (action === "donate") {
      const amount = Math.round(Number(body.amount));
      if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: "Amount must be zero or a positive number" }, { status: 400 });
      await submitDonation(cycleId, session!.user.teamId, amount);
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
