import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { marketRequests, modelState, globalState, teams, teamNotifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/api-helpers";
import { computeMarketPrice, POLITICAL_TENSION_LOCKOUT_THRESHOLD } from "@/lib/economy";

// GET: current adaptive WHO HQ pricing + stock, plus every pending/recent
// request (visible to all teams, not just the requester — item 3's "other
// regions get a brief heads-up window to also submit a request before the
// instructor processes the batch" depends on everyone seeing the pending
// queue as it forms).
export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const gs = await db.query.globalState.findFirst({ where: eq(globalState.id, 1) });
  if (!gs) return NextResponse.json({ error: "Simulation not initialized" }, { status: 500 });

  const prices = {
    PPE_DAYS: computeMarketPrice({ resourceType: "PPE_DAYS", escalationState: gs.escalationState, whoHqPpeStock: gs.whoHqPpeStock, whoHqAntiviralsStock: gs.whoHqAntiviralsStock }),
    ANTIVIRALS: computeMarketPrice({ resourceType: "ANTIVIRALS", escalationState: gs.escalationState, whoHqPpeStock: gs.whoHqPpeStock, whoHqAntiviralsStock: gs.whoHqAntiviralsStock }),
  };

  const allTeams = await db.query.teams.findMany();
  const requests = await db.query.marketRequests.findMany({ orderBy: (t, { desc }) => [desc(t.createdAt)], limit: 30 });
  const enriched = requests.map((r) => ({ ...r, regionId: allTeams.find((t) => t.id === r.teamId)?.regionId ?? "?" }));

  return NextResponse.json({
    prices,
    whoHqPpeStock: gs.whoHqPpeStock,
    whoHqAntiviralsStock: gs.whoHqAntiviralsStock,
    requests: enriched,
  });
}

// POST: a team requests to buy PPE/antivirals from WHO HQ's stockpile at the
// current adaptive price. Price is locked at request time. Requires
// instructor approval — see app/api/instructor/market/route.ts.
export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (session!.user.role !== "student" || !session!.user.teamId) {
    return NextResponse.json({ error: "Only teams can submit purchase requests" }, { status: 403 });
  }

  const body = await req.json();
  const resourceType = body.resourceType as "PPE_DAYS" | "ANTIVIRALS";
  const amount = Math.round(Number(body.amount));
  if (resourceType !== "PPE_DAYS" && resourceType !== "ANTIVIRALS") {
    return NextResponse.json({ error: "Invalid resource type" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  const gs = await db.query.globalState.findFirst({ where: eq(globalState.id, 1) });
  if (!gs) return NextResponse.json({ error: "Simulation not initialized" }, { status: 500 });

  const pricePerUnit = computeMarketPrice({ resourceType, escalationState: gs.escalationState, whoHqPpeStock: gs.whoHqPpeStock, whoHqAntiviralsStock: gs.whoHqAntiviralsStock });
  const totalCost = Math.round(pricePerUnit * amount);

  const team = await db.query.teams.findFirst({ where: eq(teams.id, session!.user.teamId) });
  const state = team ? await db.query.modelState.findFirst({ where: eq(modelState.regionId, team.regionId) }) : null;
  if (!state) return NextResponse.json({ error: "Region not found" }, { status: 404 });
  if (state.politicalTensionIndex >= POLITICAL_TENSION_LOCKOUT_THRESHOLD) {
    return NextResponse.json(
      { error: `Cooperation with WHO HQ is currently ruptured (political tension ${state.politicalTensionIndex}/100) — resolve EVT-025 before buying from WHO HQ.` },
      { status: 403 }
    );
  }
  if (state.fundRemaining < totalCost) {
    return NextResponse.json({ error: `This would cost $${totalCost.toLocaleString()} — you only have $${state.fundRemaining.toLocaleString()} available.` }, { status: 400 });
  }

  const [request] = await db
    .insert(marketRequests)
    .values({ teamId: session!.user.teamId, resourceType, amount, pricePerUnit, totalCost })
    .returning();

  const allTeams = await db.query.teams.findMany();
  for (const t of allTeams) {
    if (t.id === session!.user.teamId) continue;
    await db.insert(teamNotifications).values({
      teamId: t.id,
      kind: "market",
      message: `${team!.regionId} requested to buy ${amount.toLocaleString()} ${resourceType === "PPE_DAYS" ? "PPE-days" : "antiviral doses"} from WHO HQ — submit your own request in the next 30s if you want in on this batch.`,
    });
  }

  return NextResponse.json({ request });
}
