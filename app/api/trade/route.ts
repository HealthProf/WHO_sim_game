import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { regionTradeOffers, modelState, teams, teamNotifications, modelStateHistory } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireSession } from "@/lib/api-helpers";
import { tryDeductRegionField, creditRegionField } from "@/lib/db-atomic";

// GET: trade offers involving the requesting team, either side (visible to
// everyone for transparency, same as coordination/pledges).
export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const offers = await db.query.regionTradeOffers.findMany({ orderBy: (t, { desc }) => [desc(t.createdAt)], limit: 30 });
  const allTeams = await db.query.teams.findMany();
  const enriched = offers.map((o) => ({
    ...o,
    fromRegionId: allTeams.find((t) => t.id === o.fromTeamId)?.regionId ?? "?",
    toRegionId: allTeams.find((t) => t.id === o.toTeamId)?.regionId ?? "?",
  }));
  return NextResponse.json({ offers: enriched });
}

// POST: a team offers to buy a resource from another region at a price it
// proposes. Simplified (per design discussion): the receiving region can
// only accept or reject — no counter-offer round-trip.
export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (session!.user.role !== "student" || !session!.user.teamId) {
    return NextResponse.json({ error: "Only teams can propose trades" }, { status: 403 });
  }

  const body = await req.json();
  const toRegionId = body.toRegionId as string;
  const resourceType = body.resourceType as "PPE_DAYS" | "ANTIVIRALS";
  const amount = Math.round(Number(body.amount));
  const pricePerUnit = Number(body.pricePerUnit);

  if (resourceType !== "PPE_DAYS" && resourceType !== "ANTIVIRALS") {
    return NextResponse.json({ error: "Invalid resource type" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(pricePerUnit) || pricePerUnit <= 0) {
    return NextResponse.json({ error: "Amount and price must be positive numbers" }, { status: 400 });
  }
  if (toRegionId === session!.user.regionId) {
    return NextResponse.json({ error: "Can't trade with your own region" }, { status: 400 });
  }

  const fromTeam = await db.query.teams.findFirst({ where: eq(teams.id, session!.user.teamId) });
  const toTeam = await db.query.teams.findFirst({ where: eq(teams.regionId, toRegionId) });
  if (!fromTeam || !toTeam) return NextResponse.json({ error: "Region not found" }, { status: 404 });

  const totalPrice = Math.round(pricePerUnit * amount);
  const buyerState = await db.query.modelState.findFirst({ where: eq(modelState.regionId, fromTeam.regionId) });
  if (!buyerState || buyerState.fundRemaining < totalPrice) {
    return NextResponse.json({ error: `This offer totals $${totalPrice.toLocaleString()} — you only have $${buyerState?.fundRemaining.toLocaleString() ?? 0} available.` }, { status: 400 });
  }

  const [offer] = await db
    .insert(regionTradeOffers)
    .values({ fromTeamId: fromTeam.id, toTeamId: toTeam.id, resourceType, amount, pricePerUnit, totalPrice })
    .returning();

  await db.insert(teamNotifications).values({
    teamId: toTeam.id,
    kind: "trade",
    message: `${fromTeam.regionId} offers to buy ${amount.toLocaleString()} ${resourceType === "PPE_DAYS" ? "PPE-days" : "antiviral doses"} from you for $${totalPrice.toLocaleString()} — visit Trade to accept or reject.`,
  });

  return NextResponse.json({ offer });
}

// PATCH: the receiving region accepts or rejects a pending offer.
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (session!.user.role !== "student" || !session!.user.teamId) {
    return NextResponse.json({ error: "Only teams can respond to trades" }, { status: 403 });
  }

  const body = await req.json();
  const offerId = Number(body.offerId);
  const action = body.action as "accept" | "reject";

  const offer = await db.query.regionTradeOffers.findFirst({ where: eq(regionTradeOffers.id, offerId) });
  if (!offer || offer.status !== "pending") return NextResponse.json({ error: "Offer not found or already resolved" }, { status: 404 });
  if (offer.toTeamId !== session!.user.teamId) return NextResponse.json({ error: "This offer isn't addressed to your region" }, { status: 403 });

  if (action === "reject") {
    await db.update(regionTradeOffers).set({ status: "rejected", resolvedAt: new Date() }).where(eq(regionTradeOffers.id, offerId));
    const buyerTeam = await db.query.teams.findFirst({ where: eq(teams.id, offer.fromTeamId) });
    if (buyerTeam) await db.insert(teamNotifications).values({ teamId: buyerTeam.id, kind: "trade", message: `Your trade offer was declined.` });
    return NextResponse.json({ ok: true });
  }

  const buyerTeam = await db.query.teams.findFirst({ where: eq(teams.id, offer.fromTeamId) });
  const sellerTeam = await db.query.teams.findFirst({ where: eq(teams.id, offer.toTeamId) });
  if (!buyerTeam || !sellerTeam) return NextResponse.json({ error: "Region not found" }, { status: 404 });

  const resourceField = offer.resourceType === "PPE_DAYS" ? "ppeDaysRemaining" : "antiviralsRemaining";

  // Claim the offer first (guarded by status='pending' in the WHERE
  // clause) so two concurrent accept clicks can't both succeed — then each
  // balance change is an atomic conditional update, with the earlier step
  // compensated back out if a later one fails (see lib/db-atomic.ts).
  const claimed = await db
    .update(regionTradeOffers)
    .set({ status: "accepted", resolvedAt: new Date() })
    .where(and(eq(regionTradeOffers.id, offerId), eq(regionTradeOffers.status, "pending")))
    .returning();
  if (claimed.length === 0) return NextResponse.json({ error: "Offer was already resolved" }, { status: 409 });

  const sellerDeducted = await tryDeductRegionField(sellerTeam.regionId, resourceField, offer.amount);
  if (!sellerDeducted) {
    await db.update(regionTradeOffers).set({ status: "rejected" }).where(eq(regionTradeOffers.id, offerId));
    return NextResponse.json({ error: `You no longer have ${offer.amount.toLocaleString()} to sell.` }, { status: 400 });
  }

  const buyerDeducted = await tryDeductRegionField(buyerTeam.regionId, "fundRemaining", offer.totalPrice);
  if (!buyerDeducted) {
    await creditRegionField(sellerTeam.regionId, resourceField, offer.amount); // compensate the seller deduction above
    await db.update(regionTradeOffers).set({ status: "rejected" }).where(eq(regionTradeOffers.id, offerId));
    return NextResponse.json({ error: `${buyerTeam.regionId} no longer has enough funds for this trade.` }, { status: 400 });
  }

  await creditRegionField(buyerTeam.regionId, resourceField, offer.amount);
  await creditRegionField(sellerTeam.regionId, "fundRemaining", offer.totalPrice);

  const reason = `Trade: ${buyerTeam.regionId} bought ${offer.amount.toLocaleString()} ${offer.resourceType === "PPE_DAYS" ? "PPE-days" : "antiviral doses"} from ${sellerTeam.regionId} for $${offer.totalPrice.toLocaleString()}`;
  const [updatedBuyer, updatedSeller] = await Promise.all([
    db.query.modelState.findFirst({ where: eq(modelState.regionId, buyerTeam.regionId) }),
    db.query.modelState.findFirst({ where: eq(modelState.regionId, sellerTeam.regionId) }),
  ]);
  if (updatedBuyer) await db.insert(modelStateHistory).values({ regionId: buyerTeam.regionId, day: updatedBuyer.day, snapshotJson: updatedBuyer, reason });
  if (updatedSeller) await db.insert(modelStateHistory).values({ regionId: sellerTeam.regionId, day: updatedSeller.day, snapshotJson: updatedSeller, reason });
  await db.insert(teamNotifications).values({ teamId: buyerTeam.id, kind: "trade", message: `Trade accepted: ${reason}.` });
  await db.insert(teamNotifications).values({ teamId: sellerTeam.id, kind: "trade", message: `Trade accepted: ${reason}.` });

  return NextResponse.json({ ok: true });
}
