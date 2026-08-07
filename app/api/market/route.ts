import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { marketRequests, modelState, sessionState, teams, teamNotifications } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { requireActor, requireTeamActor } from "@/lib/session-context";
import { computeMarketPrice } from "@/lib/economy";
import { POLITICAL_TENSION_LOCKOUT_THRESHOLD } from "@/lib/config";
import { logAnalyticsEvent } from "@/lib/analytics";

// GET: current adaptive WHO HQ pricing + stock, plus every pending/recent
// request (visible to all teams, not just the requester — item 3's "other
// regions get a brief heads-up window to also submit a request before the
// instructor processes the batch" depends on everyone seeing the pending
// queue as it forms).
export async function GET() {
  const { actor, error } = await requireActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  if (!gs) return NextResponse.json({ error: "Simulation not initialized" }, { status: 500 });

  const prices = {
    PPE_DAYS: computeMarketPrice({ resourceType: "PPE_DAYS", escalationState: gs.escalationState, whoHqPpeStock: gs.whoHqPpeStock, whoHqAntiviralsStock: gs.whoHqAntiviralsStock, intensityMultiplier: gs.intensityMultiplier }),
    ANTIVIRALS: computeMarketPrice({ resourceType: "ANTIVIRALS", escalationState: gs.escalationState, whoHqPpeStock: gs.whoHqPpeStock, whoHqAntiviralsStock: gs.whoHqAntiviralsStock, intensityMultiplier: gs.intensityMultiplier }),
  };

  const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });
  const requests = await db.query.marketRequests.findMany({
    where: eq(marketRequests.sessionId, sessionId),
    orderBy: desc(marketRequests.createdAt),
    limit: 30,
  });
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
  const { actor, error } = await requireTeamActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json();
  const resourceType = body.resourceType as "PPE_DAYS" | "ANTIVIRALS";
  const amount = Math.round(Number(body.amount));
  if (resourceType !== "PPE_DAYS" && resourceType !== "ANTIVIRALS") {
    return NextResponse.json({ error: "Invalid resource type" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }

  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  if (!gs) return NextResponse.json({ error: "Simulation not initialized" }, { status: 500 });

  const pricePerUnit = computeMarketPrice({ resourceType, escalationState: gs.escalationState, whoHqPpeStock: gs.whoHqPpeStock, whoHqAntiviralsStock: gs.whoHqAntiviralsStock, intensityMultiplier: gs.intensityMultiplier });
  const totalCost = Math.round(pricePerUnit * amount);

  const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.id, actor!.teamId!)) });
  const state = team ? await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, team.regionId)) }) : null;
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
    .values({ sessionId, teamId: actor!.teamId!, resourceType, amount, pricePerUnit, totalCost })
    .returning();

  const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });
  const otherTeams = allTeams.filter((t) => t.id !== actor!.teamId);
  if (otherTeams.length > 0) {
    await db.insert(teamNotifications).values(
      otherTeams.map((t) => ({
        sessionId,
        teamId: t.id,
        kind: "market",
        message: `${team!.regionId} requested to buy ${amount.toLocaleString()} ${resourceType === "PPE_DAYS" ? "PPE-days" : "antiviral doses"} from WHO HQ — submit your own request in the next 30s if you want in on this batch.`,
      }))
    );
  }

  await logAnalyticsEvent({
    sessionId,
    mode: actor!.mode,
    eventType: "marketplace_purchase",
    actorRole: actor!.role,
    regionId: actor!.regionId,
    userId: actor!.userId,
    metadata: { resourceType, amount, pricePerUnit, totalCost },
  });

  return NextResponse.json({ request });
}
