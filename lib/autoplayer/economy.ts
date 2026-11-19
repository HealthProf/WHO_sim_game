// Computer regions taking part in the economy (Release 3), so solo players
// and classes with computer-run regions see a world where other regions
// actually help (or don't) and buy supplies. Kept deliberately modest:
//
// - Emergency funding: each computer region decides once per open request
//   (deterministic per request+region, so ticks don't re-roll) whether to
//   contribute, with a chance by profile; strong regions give most often.
//   Amount is a small share of its own fund, capped.
// - WHO HQ marketplace: when its PPE runs low, a computer region files a
//   purchase request at the current price, if it can afford it and doesn't
//   already have one pending. The facilitator (or computer facilitator)
//   approves it like any other.
//
// Respects the phased unlock (lib/feature-unlock.ts) and the tension lockout,
// same as a human team. Every query is scoped to the session.
import { db } from "../db";
import { emergencyFundingRequests, marketRequests, modelState, sessionState, teams } from "../db/schema";
import { and, eq } from "drizzle-orm";
import { featureUnlocksFor } from "../feature-gate";
import { contributeToRequest } from "../facilitator-actions";
import { computeMarketPrice } from "../economy";
import { POLITICAL_TENSION_LOCKOUT_THRESHOLD } from "../config";
import type { CompetenceProfile } from "./index";

const CONTRIBUTE_CHANCE: Record<CompetenceProfile, number> = { strong: 0.6, mixed: 0.35, struggling: 0.1 };
const CONTRIBUTE_SHARE_OF_FUND = 0.08;
const CONTRIBUTE_CAP = 10_000_000;
const PPE_LOW_DAYS = 10;
const PPE_PURCHASE_DAYS = 10;

// Stable pseudo-random fraction in [0,1) from a string (FNV-1a), so a
// decision made on one tick is the same on the next.
export function stableFraction(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}

export async function computerEconomyTurn(sessionId: string, region: { regionId: string; profile: CompetenceProfile }): Promise<void> {
  const unlocks = await featureUnlocksFor(sessionId);
  const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.regionId, region.regionId)) });
  const state = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, region.regionId)) });
  if (!team || !state) return;

  if (unlocks.pledges.open) {
    const open = await db.query.emergencyFundingRequests.findMany({
      where: and(eq(emergencyFundingRequests.sessionId, sessionId), eq(emergencyFundingRequests.status, "open")),
    });
    for (const r of open) {
      if (r.requestingTeamId === team.id) continue;
      if (stableFraction(`${sessionId}:${r.id}:${region.regionId}:give`) >= CONTRIBUTE_CHANCE[region.profile]) continue;
      const amount = Math.min(CONTRIBUTE_CAP, Math.round(state.fundRemaining * CONTRIBUTE_SHARE_OF_FUND), r.amountRequested);
      if (amount <= 0) continue;
      // Returns false (no-op) if this region already contributed.
      await contributeToRequest(sessionId, r.id, amount, { whoHq: false, teamId: team.id, regionId: region.regionId });
    }
  }

  if (unlocks.market.open && state.ppeDaysRemaining < PPE_LOW_DAYS && state.politicalTensionIndex < POLITICAL_TENSION_LOCKOUT_THRESHOLD) {
    const pending = await db.query.marketRequests.findFirst({
      where: and(eq(marketRequests.sessionId, sessionId), eq(marketRequests.teamId, team.id), eq(marketRequests.status, "pending")),
    });
    if (pending) return;
    const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
    if (!gs) return;
    const pricePerUnit = computeMarketPrice({
      resourceType: "PPE_DAYS",
      escalationState: gs.escalationState,
      whoHqPpeStock: gs.whoHqPpeStock,
      whoHqAntiviralsStock: gs.whoHqAntiviralsStock,
      intensityMultiplier: gs.intensityMultiplier,
    });
    const totalCost = Math.round(pricePerUnit * PPE_PURCHASE_DAYS);
    if (totalCost > state.fundRemaining || gs.whoHqPpeStock < PPE_PURCHASE_DAYS) return;
    await db.insert(marketRequests).values({ sessionId, teamId: team.id, resourceType: "PPE_DAYS", amount: PPE_PURCHASE_DAYS, pricePerUnit, totalCost });
  }
}
