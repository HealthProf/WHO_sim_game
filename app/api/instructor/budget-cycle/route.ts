import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { budgetCycles, budgetCycleResponses, budgetCycleDonations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireInstructor } from "@/lib/api-helpers";
import { defaultAmountForRegion, pushCustomDisbursement, pushDefaultDisbursement, startSnapVoteCycle } from "@/lib/budget-cycle";

// GET: the current (non-closed) budget cycle, if any, with full detail —
// every region's default amount and (once responses/donations exist) the
// live breakdown, for the Control page's Budget Cycle panel.
export async function GET() {
  const { error } = await requireInstructor();
  if (error) return error;

  const cycle = await db.query.budgetCycles.findFirst({ where: (t, { ne }) => ne(t.status, "closed"), orderBy: (t, { desc }) => [desc(t.id)] });
  const allRegions = await db.query.regions.findMany();
  const defaults = Object.fromEntries(allRegions.map((r) => [r.id, defaultAmountForRegion(r.startingFund)]));

  if (!cycle) return NextResponse.json({ cycle: null, defaults });

  const responses = await db.query.budgetCycleResponses.findMany({ where: eq(budgetCycleResponses.budgetCycleId, cycle.id) });
  const donations = await db.query.budgetCycleDonations.findMany({ where: eq(budgetCycleDonations.budgetCycleId, cycle.id) });
  const allTeams = await db.query.teams.findMany();

  return NextResponse.json({
    cycle,
    defaults,
    responses: responses.map((r) => ({ ...r, regionId: allTeams.find((t) => t.id === r.teamId)?.regionId ?? "?" })),
    donations: donations.map((d) => ({ ...d, fromRegionId: allTeams.find((t) => t.id === d.fromTeamId)?.regionId ?? "?", toRegionId: allTeams.find((t) => t.id === d.toTeamId)?.regionId ?? "?" })),
  });
}

// POST: instructor picks a mode for the pending cycle.
export async function POST(req: NextRequest) {
  const { session, error } = await requireInstructor();
  if (error) return error;

  const body = await req.json();
  const cycleId = Number(body.cycleId);
  const mode = body.mode as "default" | "custom" | "snap_vote";

  const cycle = await db.query.budgetCycles.findFirst({ where: eq(budgetCycles.id, cycleId) });
  if (!cycle || cycle.status !== "pending_instructor") return NextResponse.json({ error: "Cycle not found or already handled" }, { status: 404 });

  if (mode === "default") {
    await pushDefaultDisbursement(cycleId, Number(session!.user.id));
  } else if (mode === "custom") {
    const amounts = body.amounts as Record<string, number>;
    if (!amounts) return NextResponse.json({ error: "Custom amounts required" }, { status: 400 });
    await pushCustomDisbursement(cycleId, amounts, Number(session!.user.id));
  } else if (mode === "snap_vote") {
    await startSnapVoteCycle(cycleId, Number(session!.user.id));
  } else {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
