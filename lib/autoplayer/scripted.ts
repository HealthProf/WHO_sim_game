// Scripted autoplayer: samples a target tier from the region's competence
// profile, then picks uniformly among that event's options at the sampled
// tier (falling back to the nearest tier with any option, then to the
// cheapest option overall) — filtered to what the region can currently
// afford throughout. See lib/config.ts AUTOPLAY_PROFILE_DISTRIBUTIONS for
// the profile distributions this samples from.
import { db } from "../db";
import { modelState as modelStateTable } from "../db/schema";
import { eq } from "drizzle-orm";
import { gradeDecision } from "../auto-grade";
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

// Release 3 "stress" modifier: a region whose public trust or morale has
// fallen below 45 (the first warning-event threshold) makes somewhat worse
// calls, and one doing well (trust 80+, the first reward milestone) makes
// somewhat better ones, so computer regions react to how their game is going
// instead of playing at a fixed level. Moves STRESS_SHIFT of probability one
// tier worse (or better) at each step.
const STRESS_SHIFT = 0.15;

export function stressAdjustedDistribution(
  profile: CompetenceProfile,
  state?: { publicTrustIndex: number; populationHappinessIndex: number }
): Record<Tier, number> {
  const dist = { ...AUTOPLAY_PROFILE_DISTRIBUTIONS[profile] };
  if (!state) return dist;
  const stressed = state.publicTrustIndex < 45 || state.populationHappinessIndex < 45;
  const thriving = state.publicTrustIndex >= 80;
  if (!stressed && !thriving) return dist;
  const order = stressed ? TIER_ORDER : [...TIER_ORDER].reverse();
  for (let i = 0; i < order.length - 1; i++) {
    const moved = Math.min(dist[order[i]], STRESS_SHIFT * dist[order[i]] + (i === 0 ? STRESS_SHIFT / 2 : 0));
    dist[order[i]] -= moved;
    dist[order[i + 1]] += moved;
  }
  return dist;
}

function sampleTier(profile: CompetenceProfile, state?: { publicTrustIndex: number; populationHappinessIndex: number }): Tier {
  const dist = stressAdjustedDistribution(profile, state);
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

// Population in billions (simulation-docs/04-regions.md), for allocations.
const POPULATION_B: Record<string, number> = { AFRO: 1.1, AMRO: 1.0, EMRO: 0.679, EURO: 0.93, SEARO: 2.0, WPRO: 1.9 };
// "Political/economic weight" used by the struggling style: richer, more
// powerful regions pull more doses (the authored Inadequate pattern).
const POWER_WEIGHT: Record<string, number> = { AFRO: 0.5, AMRO: 2.2, EMRO: 1.0, EURO: 2.0, SEARO: 0.8, WPRO: 1.5 };

const ALLOCATION_RATIONALE: Record<CompetenceProfile, string> = {
  strong:
    "We weight doses by need: population times current case-fatality burden, which prioritizes AFRO and SEARO where low hospital capacity makes each dose prevent the most deaths. Every region receives some supply, and we will review the split against new data.",
  mixed:
    "We split doses roughly by population, a simple and defensible rule that every member state can accept, with small adjustments. It does not fully account for differences in fatality burden or health-system capacity.",
  struggling:
    "We allocate in line with funding contributions and existing commitments, which keeps major donor states on board. Lower-resource regions receive a smaller share for now.",
};

// Builds a 180,000-dose allocation in the given profile's style, with
// +/-10% per-region jitter, summing exactly to the total.
export function profileAllocation(profile: CompetenceProfile, cfr: Record<string, number>, rng: () => number = Math.random, total = 180_000): Record<string, number> {
  const weight = (r: string) => {
    if (profile === "strong") return POPULATION_B[r] * (cfr[r] && cfr[r] > 0 ? cfr[r] : 1) * (r === "AFRO" || r === "SEARO" ? 1.25 : 1);
    if (profile === "mixed") return POPULATION_B[r];
    return POPULATION_B[r] * POWER_WEIGHT[r];
  };
  const raw = REGIONS.map((r) => weight(r) * (0.9 + rng() * 0.2));
  const sum = raw.reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  let remaining = total;
  REGIONS.forEach((r, i) => {
    if (i === REGIONS.length - 1) {
      out[r] = remaining;
      return;
    }
    const share = Math.round((total * raw[i]) / sum);
    out[r] = share;
    remaining -= share;
  });
  return out;
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
      // Release 3: each profile allocates in its own style (with a little
      // jitter so two runs differ), and the tier comes from the same
      // rule-based grader applied to human teams (lib/auto-grade.ts), so a
      // computer region's grade matches what it actually allocated.
      const states = await db.query.modelState.findMany({ where: eq(modelStateTable.sessionId, ctx.sessionId) });
      const cfr = Object.fromEntries(states.map((s) => [s.regionId, s.cfrMultiplier]));
      const allocation = profileAllocation(profile, cfr);
      const grade = gradeDecision({
        event: { id: event.id, minRationaleWords: 0, isAllocationEvent: true, requiresMandatoryReview: false, structuredOptionsJson: null },
        decision: { structuredChoice: null, rationaleText: "", resourceAllocationJson: allocation },
        cfrMultiplierByRegion: cfr,
      });
      return {
        optionLabel: null,
        rationaleText: ALLOCATION_RATIONALE[profile],
        resourceAllocationJson: allocation,
        confidenceLevel,
        tier: grade.tier,
        rationale: `${profile} allocation style; graded ${grade.tier}: ${grade.reasons.join(" ")}`,
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

    const sampledTier = sampleTier(profile, modelState);
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
