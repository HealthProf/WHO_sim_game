import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { emergencyFundingContributions, emergencyFundingRequests, marketRequests, regionTradeOffers, teams } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { resetDb, seedStaticOnce } from "./helpers/db";
import { createTestSession } from "./helpers/session";
import { cancelEmergencyRequest, cancelMarketRequest, cancelTradeOffer } from "@/lib/cancel-requests";

async function teamOf(sessionId: string, regionId: string) {
  const t = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.regionId, regionId)) });
  return t!;
}

// Release 1: a region can withdraw its own pending ask. Must be scoped to the
// caller's session and team, and must never win against an approval /
// acceptance / contribution that already happened.
describe("cancelling requests", () => {
  beforeEach(async () => {
    await resetDb();
    await seedStaticOnce();
  });

  it("market request: only the owning team in the owning session can cancel, once", async () => {
    const a = await createTestSession("instructor");
    const b = await createTestSession("instructor");
    const afro = await teamOf(a.sessionId, "AFRO");
    const amro = await teamOf(a.sessionId, "AMRO");
    const afroB = await teamOf(b.sessionId, "AFRO");
    const [req] = await db
      .insert(marketRequests)
      .values({ sessionId: a.sessionId, teamId: afro.id, resourceType: "PPE_DAYS", amount: 10, pricePerUnit: 1, totalCost: 10 })
      .returning();

    expect(await cancelMarketRequest(a.sessionId, amro.id, req.id)).toBe(false); // another team
    expect(await cancelMarketRequest(b.sessionId, afroB.id, req.id)).toBe(false); // another session
    expect(await cancelMarketRequest(a.sessionId, afro.id, req.id)).toBe(true);
    expect(await cancelMarketRequest(a.sessionId, afro.id, req.id)).toBe(false); // already cancelled
    const row = await db.query.marketRequests.findFirst({ where: eq(marketRequests.id, req.id) });
    expect(row!.status).toBe("cancelled");
  });

  it("market request: a concurrent approve-claim and cancel never both succeed", async () => {
    const { sessionId } = await createTestSession("instructor");
    const afro = await teamOf(sessionId, "AFRO");
    for (let i = 0; i < 10; i++) {
      const [req] = await db
        .insert(marketRequests)
        .values({ sessionId, teamId: afro.id, resourceType: "PPE_DAYS", amount: 10, pricePerUnit: 1, totalCost: 10 })
        .returning();
      // Same guarded claim app/api/instructor/market uses for approval.
      const approve = db
        .update(marketRequests)
        .set({ status: "approved" })
        .where(and(eq(marketRequests.id, req.id), eq(marketRequests.status, "pending")))
        .returning()
        .then((r) => r.length > 0);
      const [approved, cancelled] = await Promise.all([approve, cancelMarketRequest(sessionId, afro.id, req.id)]);
      expect(Number(approved) + Number(cancelled)).toBe(1);
    }
  });

  it("trade offer: only the offering region can withdraw it, and only while pending", async () => {
    const { sessionId } = await createTestSession("instructor");
    const afro = await teamOf(sessionId, "AFRO");
    const euro = await teamOf(sessionId, "EURO");
    const [offer] = await db
      .insert(regionTradeOffers)
      .values({ sessionId, fromTeamId: afro.id, toTeamId: euro.id, resourceType: "PPE_DAYS", amount: 5, pricePerUnit: 2, totalPrice: 10 })
      .returning();
    expect(await cancelTradeOffer(sessionId, euro.id, offer.id)).toBe(false); // recipient can reject, not cancel
    await db.update(regionTradeOffers).set({ status: "accepted" }).where(eq(regionTradeOffers.id, offer.id));
    expect(await cancelTradeOffer(sessionId, afro.id, offer.id)).toBe(false);
  });

  it("emergency funding: cancellable only while nobody has contributed", async () => {
    const { sessionId } = await createTestSession("instructor");
    const afro = await teamOf(sessionId, "AFRO");
    const euro = await teamOf(sessionId, "EURO");

    const [withGift] = await db
      .insert(emergencyFundingRequests)
      .values({ sessionId, requestingTeamId: afro.id, amountRequested: 1000, reason: "test" })
      .returning();
    await db.insert(emergencyFundingContributions).values({ sessionId, requestId: withGift.id, contributorTeamId: euro.id, amount: 100 });
    expect(await cancelEmergencyRequest(sessionId, afro.id, withGift.id)).toBe(false);

    await db.update(emergencyFundingRequests).set({ status: "closed" }).where(eq(emergencyFundingRequests.id, withGift.id));
    const [fresh] = await db
      .insert(emergencyFundingRequests)
      .values({ sessionId, requestingTeamId: afro.id, amountRequested: 1000, reason: "oops, wrong amount" })
      .returning();
    expect(await cancelEmergencyRequest(sessionId, euro.id, fresh.id)).toBe(false);
    expect(await cancelEmergencyRequest(sessionId, afro.id, fresh.id)).toBe(true);
  });
});
