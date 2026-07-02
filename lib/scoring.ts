// The 40/30/30 composite formula and four-tier thresholds from
// simulation-docs/02-decision-matrix.md. This is the pedagogical core of the
// simulation — do not simplify these weights or thresholds.

export type Tier = "OPTIMAL" | "ADEQUATE" | "INADEQUATE" | "CRITICAL_FAILURE";

export interface DimensionScores {
  evidenceScore: number; // 1-4
  politicalScore: number; // 1-4
  equityScore: number; // 1-4
}

export function computeCompositePct({ evidenceScore, politicalScore, equityScore }: DimensionScores): number {
  return ((evidenceScore * 0.4 + politicalScore * 0.3 + equityScore * 0.3) / 4) * 100;
}

export function tierForCompositePct(compositePct: number): Tier {
  if (compositePct >= 85) return "OPTIMAL";
  if (compositePct >= 65) return "ADEQUATE";
  if (compositePct >= 40) return "INADEQUATE";
  return "CRITICAL_FAILURE";
}

export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

// "Calibration wager": teams self-report how confident they are in a
// decision alongside making it. This is a small additive adjustment on top
// of the untouched 40/30/30 composite/tier thresholds above — it never
// changes the base formula, it only nudges the final score toward rewarding
// good calibration (confident when right) and punishing overconfidence
// (confident when wrong). Hedging (LOW confidence) is never penalized,
// since flagging genuine uncertainty is the behavior this scenario is
// designed to teach, not something to discourage.
export function computeCalibrationAdjustment(
  confidence: ConfidenceLevel | null | undefined,
  rawTier: Tier
): number {
  if (!confidence || confidence === "MEDIUM") return 0;
  const goodTier = rawTier === "OPTIMAL" || rawTier === "ADEQUATE";
  if (confidence === "HIGH") return goodTier ? 3 : -5;
  return 0; // LOW confidence: no adjustment either way
}

// Default per-dimension scores implied by a tier, used to pre-populate the
// fast-path suggested score before the instructor accepts or overrides it.
export function defaultScoresForTier(tier: Tier): DimensionScores {
  switch (tier) {
    case "OPTIMAL":
      return { evidenceScore: 4, politicalScore: 4, equityScore: 4 };
    case "ADEQUATE":
      return { evidenceScore: 3, politicalScore: 3, equityScore: 3 };
    case "INADEQUATE":
      return { evidenceScore: 2, politicalScore: 2, equityScore: 2 };
    case "CRITICAL_FAILURE":
      return { evidenceScore: 1, politicalScore: 1, equityScore: 1 };
  }
}
