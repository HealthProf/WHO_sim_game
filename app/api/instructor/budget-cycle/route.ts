import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { budgetCycles, budgetCycleResponses, budgetCycleDonations, teams } from "@/lib/db/schema";
import { and, eq, ne, desc } from "drizzle-orm";
import { requireInstructorActor } from "@/lib/session-context";
import { defaultAmountForRegion, pushCustomDisbursement, pushDefaultDisbursement, startSnapVoteCycle } from "@/lib/budget-cycle";

// GET: the current (non-closed) budget cycle, if any, with full detail —
// every region's default amount and (once responses/donations exist) the
// live breakdown, for the Control page's Budget Cycle panel.
export async function GET() {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const cycle = await db.query.budgetCycles.findFirst({
    where: and(eq(budgetCycles.sessionId, sessionId), ne(budgetCycles.status, "closed")),
    orderBy: desc(budgetCycles.id),
  });
  const allRegions = await db.query.regions.findMany();
  const defaults = Object.fromEntries(allRegions.map((r) => [r.id, defaultAmountForRegion(r.startingFund)]));

  if (!cycle) return NextResponse.json({ cycle: null, defaults });

  const responses = await db.query.budgetCycleResponses.findMany({
    where: and(eq(budgetCycleResponses.sessionId, sessionId), eq(budgetCycleResponses.budgetCycleId, cycle.id)),
  });
  const donations = await db.query.budgetCycleDonations.findMany({
    where: and(eq(budgetCycleDonations.sessionId, sessionId), eq(budgetCycleDonations.budgetCycleId, cycle.id)),
  });
  const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });

  return NextResponse.json({
    cycle,
    defaults,
    responses: responses.map((r) => ({ ...r, regionId: allTeams.find((t) => t.id === r.teamId)?.regionId ?? "?" })),
    donations: donations.map((d) => ({ ...d, fromRegionId: allTeams.find((t) => t.id === d.fromTeamId)?.regionId ?? "?", toRegionId: allTeams.find((t) => t.id === d.toTeamId)?.regionId ?? "?" })),
  });
}

// POST: instructor picks a mode for the pending cycle.
export async function POST(req: NextRequest) {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json();
  const cycleId = Number(body.cycleId);
  const mode = body.mode as "default" | "custom" | "snap_vote";

  const cycle = await db.query.budgetCycles.findFirst({ where: and(eq(budgetCycles.sessionId, sessionId), eq(budgetCycles.id, cycleId)) });
  if (!cycle || cycle.status !== "pending_instructor") return NextResponse.json({ error: "Cycle not found or already handled" }, { status: 404 });

  if (mode === "default") {
    await pushDefaultDisbursement(sessionId, cycleId, actor!.userId!);
  } else if (mode === "custom") {
    const amounts = body.amounts as Record<string, number>;
    if (!amounts) return NextResponse.json({ error: "Custom amounts required" }, { status: 400 });
    await pushCustomDisbursement(sessionId, cycleId, amounts, actor!.userId!);
  } else if (mode === "snap_vote") {
    await startSnapVoteCycle(sessionId, cycleId, actor!.userId!);
  } else {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
