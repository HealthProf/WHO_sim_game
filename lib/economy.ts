// WHO HQ marketplace pricing (item 3) — adaptive: price rises as the global
// escalation state worsens and as WHO HQ's own stockpile depletes, so
// waiting to buy is a real gamble, not just a formality. Region-to-region
// trade offers are priced by whatever the requesting team proposes (see
// lib/db/schema.ts regionTradeOffers) — this module only prices WHO HQ's
// own sales.

const BASE_PRICE_PER_PPE_DAY = 2_000; // $ per PPE-day-equivalent unit
const BASE_PRICE_PER_ANTIVIRAL = 150; // $ per dose

const ESCALATION_MULTIPLIER: Record<string, number> = { GREEN: 1, AMBER: 1.3, RED: 1.75 };

// Scarcity multiplier: price climbs as WHO HQ's own stock depletes relative
// to its starting stock (2000 PPE-days, 200,000 antivirals — see
// lib/db/schema.ts globalState defaults). At full stock, multiplier is 1x;
// as stock approaches zero, price climbs toward 3x.
function scarcityMultiplier(currentStock: number, startingStock: number): number {
  const fraction = startingStock > 0 ? Math.max(0, Math.min(1, currentStock / startingStock)) : 0;
  return 1 + (1 - fraction) * 2;
}

export function computeMarketPrice(opts: {
  resourceType: "PPE_DAYS" | "ANTIVIRALS";
  escalationState: string;
  whoHqPpeStock: number;
  whoHqAntiviralsStock: number;
  intensityMultiplier?: number; // item 9's drama dial — defaults to 1x (no change)
}): number {
  const basePrice = opts.resourceType === "PPE_DAYS" ? BASE_PRICE_PER_PPE_DAY : BASE_PRICE_PER_ANTIVIRAL;
  const startingStock = opts.resourceType === "PPE_DAYS" ? 2000 : 200_000;
  const currentStock = opts.resourceType === "PPE_DAYS" ? opts.whoHqPpeStock : opts.whoHqAntiviralsStock;
  const escalationMult = ESCALATION_MULTIPLIER[opts.escalationState] ?? 1;
  const scarcityMult = scarcityMultiplier(currentStock, startingStock);
  const intensity = opts.intensityMultiplier && opts.intensityMultiplier > 0 ? opts.intensityMultiplier : 1.0;
  return Math.round(basePrice * escalationMult * scarcityMult * intensity * 100) / 100;
}
