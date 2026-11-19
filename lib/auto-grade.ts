// Rule-based provisional grading (Release 2). Pure: no DB access, so it is
// unit-testable and the scoring inbox, the "accept all" button, and the
// optional auto-accept tick all compute the exact same proposal.
//
// Faithfulness to simulation-docs/02-decision-matrix.md:
// - Structured choices "can be auto-scored, since each option has a
//   pre-determined consequence tier". The option's suggestedTier is the
//   starting point for all three dimensions, unchanged from before.
// - The written rationale "requires instructor judgment". A keyword check
//   cannot judge reasoning quality, so the rationale can only *lower* a
//   dimension (by at most one step) when it is missing or never touches that
//   dimension. It can never raise a grade, so keyword-stuffing gains nothing.
//   The facilitator can always override.
// - CRITICAL FAILURE "requires mandatory facilitator review", as do events
//   flagged requiresMandatoryReview. Those proposals are marked needsReview
//   and are never applied by "accept all" or auto-accept unless the
//   facilitator explicitly includes them.
// - Allocation events (EVT-006/EVT-012) are graded against their authored
//   consequence criteria in lib/db/seed-data/events.ts: Optimal prioritizes
//   AFRO/SEARO by CFR burden; Critical gives AFRO roughly zero; EVT-012 is
//   judged on whether it improves on the team's EVT-006 allocation.
import { defaultScoresForTier, computeCompositePct, tierForCompositePct, type DimensionScores, type Tier } from "./scoring";
import { RATIONALE_MIN_WORDS_CAP } from "./config";

export interface GradeInput {
  event: {
    id: string;
    minRationaleWords: number;
    isAllocationEvent: boolean;
    requiresMandatoryReview: boolean;
    structuredOptionsJson: { label: string; suggestedTier: Tier }[] | null;
  };
  decision: {
    structuredChoice: string | null;
    rationaleText: string;
    resourceAllocationJson: unknown;
    actorKind?: string;
  };
  // Current CFR multiplier per region, for allocation need-weighting.
  cfrMultiplierByRegion?: Record<string, number>;
  // The same team's EVT-006 allocation, when grading EVT-012.
  priorAllocation?: Record<string, number> | null;
}

export interface ProvisionalGrade {
  scores: DimensionScores;
  tier: Tier;
  reasons: string[];
  needsReview: boolean;
  reviewReason: string | null;
}

// Effective minimum: the seeded per-event minimum (150-400 words in the
// source design) capped at RATIONALE_MIN_WORDS_CAP, per the Release 2
// decision to ask for 2-5 sentences rather than an essay under time
// pressure. Events seeded at 0 (informational) stay at 0.
export function effectiveMinWords(seeded: number): number {
  return seeded > 0 ? Math.min(seeded, RATIONALE_MIN_WORDS_CAP) : 0;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Signals that a rationale engages with each scoring dimension, drawn from
// the dimension definitions and category criteria in 02-decision-matrix.md.
// Matched on word starts, case-insensitively.
const DIMENSION_SIGNALS: Record<keyof DimensionScores, string[]> = {
  evidenceScore: [
    "evidence", "data", "epidemiolog", "transmission", "rt", "r0", "incubation", "serial interval", "surveillance",
    "genomic", "sequenc", "case", "cfr", "fatality", "mortality", "guideline", "cdc", "study", "studies",
    "trial", "efficacy", "model", "proportional", "risk", "contact tracing", "testing", "spread",
  ],
  politicalScore: [
    "stakeholder", "feasib", "cost", "budget", "fund", "legal", "ihr", "article", "government", "political",
    "implement", "negotiat", "partner", "diplomat", "member state", "sovereign", "compliance", "economic",
    "trade", "public support", "buy-in", "coordinat", "tension", "enforce",
  ],
  equityScore: [
    "equit", "vulnerab", "low-income", "low income", "low-resource", "low resource", "access", "margin",
    "elderly", "older adult", "65", "high-risk", "high risk", "informal", "worker", "fair", "need",
    "underserved", "under-served", "disparit", "burden", "immunocompromis", "comorbid", "pregnan",
    "incarcerat", "afro", "searo", "poor", "minorit", "rural",
  ],
};

const DIMENSION_LABEL: Record<keyof DimensionScores, string> = {
  evidenceScore: "evidence",
  politicalScore: "political/economic realism",
  equityScore: "health equity",
};

function mentions(text: string, signals: string[]): boolean {
  const t = ` ${text.toLowerCase()} `;
  return signals.some((s) => new RegExp(`(^|[^a-z0-9])${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(t));
}

// Approximate population, in billions, from simulation-docs/04-regions.md
// (lib/db/seed-data/regions.ts populationDesc).
const POPULATION_B: Record<string, number> = { AFRO: 1.1, AMRO: 1.0, EMRO: 0.679, EURO: 0.93, SEARO: 2.0, WPRO: 1.9 };
const NEAR_ZERO_SHARE = 0.02;

// Share of doses AFRO+SEARO received divided by their share of need
// (population x current CFR multiplier). 1.0 = exactly need-proportional.
export function allocationEquityRatio(alloc: Record<string, number>, cfr: Record<string, number> = {}): number | null {
  const total = Object.values(alloc).reduce((a, b) => a + (Number(b) || 0), 0);
  if (total <= 0) return null;
  const need: Record<string, number> = {};
  for (const r of Object.keys(POPULATION_B)) need[r] = POPULATION_B[r] * (cfr[r] && cfr[r] > 0 ? cfr[r] : 1);
  const needTotal = Object.values(need).reduce((a, b) => a + b, 0);
  const share = (r: string) => (Number(alloc[r]) || 0) / total;
  const priorityShare = share("AFRO") + share("SEARO");
  const priorityNeed = (need.AFRO + need.SEARO) / needTotal;
  return priorityShare / priorityNeed;
}

function tierFromRatio(ratio: number): Tier {
  if (ratio >= 1.0) return "OPTIMAL";
  if (ratio >= 0.75) return "ADEQUATE";
  return "INADEQUATE";
}

function gradeAllocation(input: GradeInput, reasons: string[]): { tier: Tier; review: string | null } {
  const alloc = (input.decision.resourceAllocationJson ?? {}) as Record<string, number>;
  const total = Object.values(alloc).reduce((a, b) => a + (Number(b) || 0), 0);
  if (total <= 0) {
    reasons.push("No doses allocated.");
    return { tier: "CRITICAL_FAILURE", review: "No allocation submitted." };
  }
  const zeroRegions = Object.keys(POPULATION_B).filter((r) => (Number(alloc[r]) || 0) / total < NEAR_ZERO_SHARE);
  if (zeroRegions.includes("AFRO")) {
    reasons.push("AFRO receives roughly zero doses (the authored Critical Failure condition).");
    return { tier: "CRITICAL_FAILURE", review: "AFRO near-zero allocation; check the rationale for any mitigation." };
  }
  const ratio = allocationEquityRatio(alloc, input.cfrMultiplierByRegion)!;
  reasons.push(`AFRO+SEARO received ${Math.round(ratio * 100)}% of their need-weighted share (population x CFR).`);

  let tier: Tier;
  if (input.event.id === "EVT-012" && input.priorAllocation) {
    const prior = allocationEquityRatio(input.priorAllocation, input.cfrMultiplierByRegion);
    if (prior == null) tier = tierFromRatio(ratio);
    else if (ratio < prior - 0.15) {
      tier = "CRITICAL_FAILURE";
      reasons.push("Less equitable than this team's EVT-006 allocation.");
    } else if (ratio > prior + 0.05 && ratio >= 0.75) {
      tier = "OPTIMAL";
      reasons.push("Improves on this team's EVT-006 allocation.");
    } else {
      tier = ratio >= 0.75 ? "ADEQUATE" : "INADEQUATE";
      reasons.push("Similar to this team's EVT-006 allocation.");
    }
  } else {
    tier = tierFromRatio(ratio);
  }

  if (zeroRegions.length > 0 && tier !== "CRITICAL_FAILURE") {
    reasons.push(`${zeroRegions.join(", ")} received roughly zero doses; the matrix treats that as Critical unless mitigation is offered.`);
    return { tier, review: `${zeroRegions.join(", ")} near-zero allocation; check the rationale for mitigation.` };
  }
  return { tier, review: null };
}

export function gradeDecision(input: GradeInput): ProvisionalGrade {
  const reasons: string[] = [];
  const reviewReasons: string[] = [];
  const minWords = effectiveMinWords(input.event.minRationaleWords);
  const rationale = input.decision.rationaleText ?? "";
  const words = wordCount(rationale);

  // 1. Starting tier.
  let base: Tier;
  let rationaleMatters = true;
  const option = input.event.structuredOptionsJson?.find((o) => o.label === input.decision.structuredChoice);
  if (option) {
    base = option.suggestedTier;
    reasons.push(`Option ${option.label} is designed as ${base.replace("_", " ").toLowerCase()}.`);
  } else if (input.event.isAllocationEvent) {
    const a = gradeAllocation(input, reasons);
    base = a.tier;
    if (a.review) reviewReasons.push(a.review);
  } else if (minWords === 0 && !input.event.structuredOptionsJson) {
    // Informational events (EVT-014/EVT-016): nothing to judge, no model
    // effect at any tier.
    base = "ADEQUATE";
    rationaleMatters = false;
    reasons.push("Informational event; no decision to grade.");
  } else {
    base = "ADEQUATE";
    reasons.push("No structured choice selected; defaulting to adequate pending your review.");
    reviewReasons.push("No structured choice to grade from.");
  }

  const scores = defaultScoresForTier(base);

  // 2. Rationale checks, downward-only, at most one step per dimension.
  if (rationaleMatters && minWords > 0) {
    const lowered = new Set<keyof DimensionScores>();
    const lower = (dim: keyof DimensionScores) => {
      if (lowered.has(dim)) return;
      scores[dim] = Math.max(1, scores[dim] - 1);
      lowered.add(dim);
    };
    if (words === 0) {
      (Object.keys(DIMENSION_SIGNALS) as (keyof DimensionScores)[]).forEach(lower);
      reasons.push("No written rationale (every dimension lowered one step).");
    } else {
      if (words < minWords) {
        lower("evidenceScore");
        reasons.push(`Rationale is ${words} words; at least ${minWords} expected (evidence lowered).`);
      }
      for (const dim of Object.keys(DIMENSION_SIGNALS) as (keyof DimensionScores)[]) {
        if (!mentions(rationale, DIMENSION_SIGNALS[dim])) {
          lower(dim);
          reasons.push(`Rationale doesn't address ${DIMENSION_LABEL[dim]} (lowered one step).`);
        }
      }
      if (lowered.size === 0) reasons.push("Rationale addresses all three dimensions.");
    }
  }

  const tier = tierForCompositePct(computeCompositePct(scores));
  if (tier === "CRITICAL_FAILURE") reviewReasons.push("Critical failure requires your review (decision matrix rule).");
  if (input.event.requiresMandatoryReview) reviewReasons.push("This event is marked for mandatory review.");

  return {
    scores,
    tier,
    reasons,
    needsReview: reviewReasons.length > 0,
    reviewReason: reviewReasons.length > 0 ? [...new Set(reviewReasons)].join(" ") : null,
  };
}
