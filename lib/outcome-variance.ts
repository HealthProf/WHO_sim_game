// Outcome variance (Release 2): a decision's designed effect is what's
// *expected*; what actually happens varies within a bounded range, the way
// real interventions land better or worse than planned. Pure, so the event
// page's "expected effect" ranges use the same bounds the scorer applies.
import type { ModelDelta } from "./db/seed-data/events";
import { OUTCOME_VARIANCE } from "./config";

// Effects that vary. Resource fields (fund/PPE/antivirals) are prices or
// transfers and stay exact.
const VARIED_FIELDS = new Set<ModelDelta["field"]>([
  "rt",
  "cfrMultiplier",
  "surveillanceIndex",
  "hospitalCapacityPct",
  "politicalTensionIndex",
  "publicTrustIndex",
  "populationHappinessIndex",
  "mediaPressureIndex",
  "hcwSurgePct",
]);

// Columns stored as integers in model_state / session_state.
const REAL_FIELDS = new Set<ModelDelta["field"]>(["rt", "cfrMultiplier"]);

export function isVaried(field: ModelDelta["field"]): boolean {
  return VARIED_FIELDS.has(field);
}

function roundForField(field: ModelDelta["field"], value: number, original: number): number {
  if (REAL_FIELDS.has(field)) return Math.round(value * 100) / 100;
  const r = Math.round(value);
  // Never let rounding erase an effect entirely or flip its sign.
  if (r === 0 && original !== 0) return Math.sign(original);
  return r;
}

export function varyDeltas(deltas: ModelDelta[], rng: () => number = Math.random, variance = OUTCOME_VARIANCE): ModelDelta[] {
  return deltas.map((d) => {
    if (!isVaried(d.field) || variance <= 0) return d;
    const factor = 1 - variance + rng() * 2 * variance;
    return { ...d, delta: roundForField(d.field, d.delta * factor, d.delta) };
  });
}

export function expectedRange(d: ModelDelta, variance = OUTCOME_VARIANCE): [number, number] {
  if (!isVaried(d.field) || variance <= 0) return [d.delta, d.delta];
  const a = roundForField(d.field, d.delta * (1 - variance), d.delta);
  const b = roundForField(d.field, d.delta * (1 + variance), d.delta);
  return a <= b ? [a, b] : [b, a];
}
