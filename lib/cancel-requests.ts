// Let a region withdraw its own ask before anyone acts on it (Release 1
// playtest feedback: "if they ask for the wrong thing, they can still cancel
// it unless a person already accepted or fulfilled it").
//
// None of these requests hold money when created (money only moves on
// approval / acceptance / contribution), so cancelling is a single guarded
// status change with nothing to refund. Each UPDATE re-checks, in the same
// statement, that the row is in this session, belongs to the caller's team,
// and is still pending/open, so it can't race an approval or acceptance (those
// claim the row with the same status guard; whichever lands first wins).
//
// Emergency funding: contributions are held until the facilitator closes the
// request, so a request can only be cancelled while it has none. A
// contribution that lands in the same instant as a cancel refunds itself (see
// app/api/emergency-funding/route.ts PATCH), so money is never stranded.
import { db } from "./db";
import { emergencyFundingContributions, emergencyFundingRequests, marketRequests, regionTradeOffers } from "./db/schema";
import { and, eq, notExists } from "drizzle-orm";

export async function cancelMarketRequest(sessionId: string, teamId: number, requestId: number): Promise<boolean> {
  const rows = await db
    .update(marketRequests)
    .set({ status: "cancelled", resolvedAt: new Date() })
    .where(
      and(
        eq(marketRequests.sessionId, sessionId),
        eq(marketRequests.id, requestId),
        eq(marketRequests.teamId, teamId),
        eq(marketRequests.status, "pending")
      )
    )
    .returning();
  return rows.length > 0;
}

// Only the region that made the offer (the buyer, fromTeamId) can withdraw it.
export async function cancelTradeOffer(sessionId: string, teamId: number, offerId: number): Promise<boolean> {
  const rows = await db
    .update(regionTradeOffers)
    .set({ status: "cancelled", resolvedAt: new Date() })
    .where(
      and(
        eq(regionTradeOffers.sessionId, sessionId),
        eq(regionTradeOffers.id, offerId),
        eq(regionTradeOffers.fromTeamId, teamId),
        eq(regionTradeOffers.status, "pending")
      )
    )
    .returning();
  return rows.length > 0;
}

export async function cancelEmergencyRequest(sessionId: string, teamId: number, requestId: number): Promise<boolean> {
  const rows = await db
    .update(emergencyFundingRequests)
    .set({ status: "cancelled", closedAt: new Date() })
    .where(
      and(
        eq(emergencyFundingRequests.sessionId, sessionId),
        eq(emergencyFundingRequests.id, requestId),
        eq(emergencyFundingRequests.requestingTeamId, teamId),
        eq(emergencyFundingRequests.status, "open"),
        notExists(
          db
            .select({ id: emergencyFundingContributions.id })
            .from(emergencyFundingContributions)
            .where(
              and(
                eq(emergencyFundingContributions.sessionId, sessionId),
                eq(emergencyFundingContributions.requestId, emergencyFundingRequests.id)
              )
            )
        )
      )
    )
    .returning();
  return rows.length > 0;
}
