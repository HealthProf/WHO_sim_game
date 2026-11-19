import { describe, expect, it } from "vitest";
import { gradeDecision, effectiveMinWords, allocationEquityRatio, type GradeInput } from "@/lib/auto-grade";
import { varyDeltas, expectedRange } from "@/lib/outcome-variance";
import { rubricsForCategory } from "@/lib/rubric";

const GOOD_RATIONALE =
  "Transmission data and the Rt estimate justify acting now under IHR Article 12. Declaring is politically costly with the host government, so we pair it with a negotiated data-sharing offer. Vulnerable, low-resource regions bear the highest burden, so equity safeguards come first.";

function structured(tier: "OPTIMAL" | "ADEQUATE" | "INADEQUATE" | "CRITICAL_FAILURE", rationale: string, extra: Partial<GradeInput["event"]> = {}): GradeInput {
  return {
    event: {
      id: "EVT-TEST",
      minRationaleWords: 200,
      isAllocationEvent: false,
      requiresMandatoryReview: false,
      structuredOptionsJson: [{ label: "A", suggestedTier: tier }],
      ...extra,
    },
    decision: { structuredChoice: "A", rationaleText: rationale, resourceAllocationJson: null },
  };
}

describe("rule-based provisional grading", () => {
  it("caps the seeded 150-400 word minimums at about 2-5 sentences", () => {
    expect(effectiveMinWords(200)).toBe(40);
    expect(effectiveMinWords(30)).toBe(30);
    expect(effectiveMinWords(0)).toBe(0);
  });

  it("keeps the option's designed tier when the rationale covers all three dimensions", () => {
    const g = gradeDecision(structured("OPTIMAL", GOOD_RATIONALE));
    expect(g.tier).toBe("OPTIMAL");
    expect(g.scores).toEqual({ evidenceScore: 4, politicalScore: 4, equityScore: 4 });
    expect(g.needsReview).toBe(false);
  });

  it("never raises a grade above the option's tier, however good the rationale", () => {
    expect(gradeDecision(structured("INADEQUATE", GOOD_RATIONALE)).tier).toBe("INADEQUATE");
  });

  it("lowers only the dimensions the rationale never addresses, by at most one step", () => {
    const noEquity =
      "Transmission data and the current Rt estimate justify acting now rather than waiting another week. Declaring is politically costly with the host government, so we negotiate a phased data-sharing plan, set aside budget for implementation, and brief our partners before the announcement.";
    const g = gradeDecision(structured("OPTIMAL", noEquity));
    expect(g.scores).toEqual({ evidenceScore: 4, politicalScore: 4, equityScore: 3 });
    expect(g.tier).toBe("OPTIMAL"); // (4*.4+4*.3+3*.3)/4 = 92.5%
  });

  it("an empty rationale lowers every dimension one step", () => {
    const g = gradeDecision(structured("OPTIMAL", ""));
    expect(g.scores).toEqual({ evidenceScore: 3, politicalScore: 3, equityScore: 3 });
    expect(g.tier).toBe("ADEQUATE");
  });

  it("flags critical failures and mandatory-review events for review", () => {
    expect(gradeDecision(structured("CRITICAL_FAILURE", GOOD_RATIONALE)).needsReview).toBe(true);
    const flagged = gradeDecision(structured("OPTIMAL", GOOD_RATIONALE, { requiresMandatoryReview: true }));
    expect(flagged.tier).toBe("OPTIMAL");
    expect(flagged.needsReview).toBe(true);
  });

  it("treats informational events as nothing to grade", () => {
    const g = gradeDecision({
      event: { id: "EVT-014", minRationaleWords: 0, isAllocationEvent: false, requiresMandatoryReview: false, structuredOptionsJson: null },
      decision: { structuredChoice: null, rationaleText: "", resourceAllocationJson: null },
    });
    expect(g.tier).toBe("ADEQUATE");
    expect(g.needsReview).toBe(false);
  });
});

describe("allocation grading against the authored EVT-006/EVT-012 criteria", () => {
  const allocEvent = (id: string): GradeInput["event"] => ({
    id,
    minRationaleWords: 200,
    isAllocationEvent: true,
    requiresMandatoryReview: true,
    structuredOptionsJson: null,
  });
  const needWeighted = { AFRO: 40000, AMRO: 15000, EMRO: 15000, EURO: 10000, SEARO: 60000, WPRO: 40000 };
  const powerWeighted = { AFRO: 10000, AMRO: 60000, EMRO: 20000, EURO: 50000, SEARO: 20000, WPRO: 20000 };

  it("AFRO near zero is a critical failure (authored condition)", () => {
    const g = gradeDecision({
      event: allocEvent("EVT-006"),
      decision: { structuredChoice: null, rationaleText: GOOD_RATIONALE, resourceAllocationJson: { ...needWeighted, AFRO: 0, SEARO: 100000 } },
    });
    expect(g.tier).toBe("CRITICAL_FAILURE");
    expect(g.needsReview).toBe(true);
  });

  it("prioritizing AFRO/SEARO by burden grades optimal; political weighting grades inadequate", () => {
    expect(allocationEquityRatio(needWeighted)!).toBeGreaterThan(1);
    expect(
      gradeDecision({ event: allocEvent("EVT-006"), decision: { structuredChoice: null, rationaleText: GOOD_RATIONALE, resourceAllocationJson: needWeighted } }).tier
    ).toBe("OPTIMAL");
    expect(
      gradeDecision({ event: allocEvent("EVT-006"), decision: { structuredChoice: null, rationaleText: GOOD_RATIONALE, resourceAllocationJson: powerWeighted } }).tier
    ).toBe("INADEQUATE");
  });

  it("weights need by current CFR multiplier", () => {
    const equal = { AFRO: 30000, AMRO: 30000, EMRO: 30000, EURO: 30000, SEARO: 30000, WPRO: 30000 };
    expect(allocationEquityRatio(equal, { AFRO: 3 })!).toBeLessThan(allocationEquityRatio(equal)!);
  });

  it("EVT-012 is judged against the team's own EVT-006 allocation", () => {
    const worse = gradeDecision({
      event: allocEvent("EVT-012"),
      decision: { structuredChoice: null, rationaleText: GOOD_RATIONALE, resourceAllocationJson: powerWeighted },
      priorAllocation: needWeighted,
    });
    expect(worse.tier).toBe("CRITICAL_FAILURE");
    const better = gradeDecision({
      event: allocEvent("EVT-012"),
      decision: { structuredChoice: null, rationaleText: GOOD_RATIONALE, resourceAllocationJson: needWeighted },
      priorAllocation: powerWeighted,
    });
    expect(better.tier).toBe("OPTIMAL");
  });
});

describe("outcome variance", () => {
  it("varies effects within bounds, never costs, and keeps integers integral", () => {
    const deltas = [
      { field: "publicTrustIndex" as const, region: "SELF" as const, delta: -10 },
      { field: "fundRemaining" as const, region: "SELF" as const, delta: -20_000_000 },
      { field: "rt" as const, region: "SELF" as const, delta: -0.4 },
    ];
    for (const r of [0, 0.5, 0.999]) {
      const [trust, fund, rt] = varyDeltas(deltas, () => r);
      expect(Number.isInteger(trust.delta)).toBe(true);
      expect(trust.delta).toBeGreaterThanOrEqual(-13);
      expect(trust.delta).toBeLessThanOrEqual(-7);
      expect(fund.delta).toBe(-20_000_000);
      expect(rt.delta).toBeGreaterThanOrEqual(-0.52);
      expect(rt.delta).toBeLessThanOrEqual(-0.28);
    }
    expect(expectedRange(deltas[0])).toEqual([-13, -7]);
  });

  it("never rounds a small effect away", () => {
    const [d] = varyDeltas([{ field: "publicTrustIndex", region: "SELF", delta: 1 }], () => 0);
    expect(d.delta).toBe(1);
  });
});

describe("rubric lookup", () => {
  it("maps compound categories to the decision matrix tables and reports gaps", () => {
    const r = rubricsForCategory("Public Communication & Risk Messaging / NPIs");
    expect(r.matched.map((m) => m.name)).toEqual(["Public Communication & Risk Messaging", "Non-Pharmaceutical Interventions (NPIs)"]);
    expect(rubricsForCategory("Institutional Authority / Public Communication").unmatched).toEqual(["Institutional Authority"]);
  });
});
