// Scripted autoplayer: samples a target tier from the region's competence
// profile, then picks uniformly among that event's options at the sampled
// tier (falling back to the nearest tier with any option, then to the
// cheapest option overall) — filtered to what the region can currently
// afford throughout. See lib/config.ts AUTOPLAY_PROFILE_DISTRIBUTIONS for
// the profile distributions this samples from.
import { db } from "../db";
import { regions } from "../db/schema";
import { AUTOPLAY_PROFILE_DISTRIBUTIONS } from "../config";
import { REGIONS } from "../regions";
import type { AutoplayerBackend, CompetenceProfile } from "./index";
import type { StructuredOption, OptionCost, Tier } from "../db/seed-data/events";

const TIER_ORDER: Tier[] = ["OPTIMAL", "ADEQUATE", "INADEQUATE", "CRITICAL_FAILURE"];

// Four events ship with no structured options at all (see build-plan
// investigation §0.4): EVT-006/EVT-012 are dose-allocation events, EVT-014/
// EVT-016 are rationale-only. Ship placeholder autoplayer behavior for all
// four rather than skipping them — EVT-006 is the scenario's pedagogical
// centerpiece and a demo without it undersells the whole thing. This is the
// one place this file invents content; everything else samples from
// already-authored event copy.
const AUTOPLAYER_PLACEHOLDER_COPY = {
  allocation:
    "[AUTOPLAYER PLACEHOLDER] This region proposes a population-weighted allocation as a defensible, if not optimized, starting point for negotiation — TODO(Tim): replace with authored autoplayer rationale for the allocation events.",
  rationaleOnly:
    "[AUTOPLAYER PLACEHOLDER] Acknowledging the briefing; no structured decision required for this event. TODO(Tim): replace with authored autoplayer rationale for EVT-014/EVT-016.",
} as const;

function sampleTier(profile: CompetenceProfile): Tier {
  const dist = AUTOPLAY_PROFILE_DISTRIBUTIONS[profile];
  const roll = Math.random();
  let cumulative = 0;
  for (const tier of TIER_ORDER) {
    cumulative += dist[tier];
    if (roll < cumulative) return tier;
  }
  return "CRITICAL_FAILURE";
}

function canAfford(cost: OptionCost | undefined, state: { fundRemaining: number; ppeDaysRemaining: number; antiviralsRemaining: number }): boolean {
  if (!cost) return true;
  return (
    (cost.fund ?? 0) <= state.fundRemaining &&
    (cost.ppeDays ?? 0) <= state.ppeDaysRemaining &&
    (cost.antivirals ?? 0) <= state.antiviralsRemaining
  );
}

// Rough fund-equivalent total, for ranking "cheapest option" when nothing
// is affordable at any sampled/fallback tier — a broke region making the
// cheapest bad choice available is exactly the intended texture (see
// lib/economy.ts's base prices for where these weights come from).
function costWeight(cost: OptionCost | undefined): number {
  if (!cost) return 0;
  return (cost.fund ?? 0) + (cost.ppeDays ?? 0) * 2000 + (cost.antivirals ?? 0) * 150;
}

function sampleConfidence(profile: CompetenceProfile): "LOW" | "MEDIUM" | "HIGH" {
  const roll = Math.random();
  if (profile === "strong") return roll < 0.6 ? "HIGH" : roll < 0.9 ? "MEDIUM" : "LOW";
  if (profile === "struggling") return roll < 0.5 ? "LOW" : roll < 0.85 ? "MEDIUM" : "HIGH";
  return roll < 0.34 ? "LOW" : roll < 0.74 ? "MEDIUM" : "HIGH";
}

export const scriptedAutoplayer: AutoplayerBackend = {
  async decideForRegion(ctx) {
    const { event, modelState, profile } = ctx;
    const confidenceLevel = sampleConfidence(profile);

    if (event.isAllocationEvent) {
      const allRegions = await db.query.regions.findMany();
      const totalWeight = allRegions.reduce((s, r) => s + r.populationWeight, 0);
      const allocation: Record<string, number> = {};
      let remaining = 180_000;
      const ordered = REGIONS.map((id) => allRegions.find((r) => r.id === id)).filter((r): r is typeof regions.$inferSelect => !!r);
      ordered.forEach((r, i) => {
        if (i === ordered.length - 1) {
          allocation[r.id] = remaining; // last region absorbs any rounding remainder, so the sum is always exact
          return;
        }
        const share = Math.round(180_000 * (r.populationWeight / totalWeight));
        allocation[r.id] = share;
        remaining -= share;
      });
      return {
        optionLabel: null,
        rationaleText: AUTOPLAYER_PLACEHOLDER_COPY.allocation,
        resourceAllocationJson: allocation,
        confidenceLevel,
        tier: sampleTier(profile),
        rationale: "isAllocationEvent placeholder: population-weighted split",
      };
    }

    const options = event.structuredOptionsJson as StructuredOption[] | null;
    if (!options || options.length === 0) {
      return {
        optionLabel: null,
        rationaleText: AUTOPLAYER_PLACEHOLDER_COPY.rationaleOnly,
        confidenceLevel,
        tier: sampleTier(profile),
        rationale: "no structured options: placeholder rationale-only response",
      };
    }

    const affordable = options.filter((o) => canAfford(o.cost, modelState));
    const pool = affordable.length > 0 ? affordable : options;

    const sampledTier = sampleTier(profile);
    let candidates = pool.filter((o) => o.suggestedTier === sampledTier);

    if (candidates.length === 0) {
      // Fall back to the nearest tier (by index distance) that has any
      // option in the affordable pool — most events have options across
      // only ~3 of the 4 tiers.
      const sortedByDistance = [...TIER_ORDER].sort(
        (a, b) => Math.abs(TIER_ORDER.indexOf(a) - TIER_ORDER.indexOf(sampledTier)) - Math.abs(TIER_ORDER.indexOf(b) - TIER_ORDER.indexOf(sampledTier))
      );
      for (const tier of sortedByDistance) {
        candidates = pool.filter((o) => o.suggestedTier === tier);
        if (candidates.length > 0) break;
      }
    }

    if (candidates.length === 0) {
      // Nothing affordable at any tier — pick the cheapest option overall,
      // affordable or not (a broke region making a bad cheap choice is
      // intended texture, not a bug).
      candidates = [options.slice().sort((a, b) => costWeight(a.cost) - costWeight(b.cost))[0]];
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];

    return {
      optionLabel: chosen.label,
      rationaleText: `[Scripted autoplayer, ${profile} profile] ${chosen.impactDesc}`,
      confidenceLevel,
      tier: chosen.suggestedTier,
      rationale: `sampled tier ${sampledTier}, chose option ${chosen.label} (suggestedTier ${chosen.suggestedTier})`,
    };
  },
};
