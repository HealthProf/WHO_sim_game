// Plain-language labels for model fields, used by the event summary's
// expected effects and the post-score result reveal. Pure (client-safe).
import type { ModelDelta } from "./db/seed-data/events";

type Field = ModelDelta["field"];

export const FIELD_LABEL: Record<Field, string> = {
  rt: "Rt",
  cfrMultiplier: "Death-rate multiplier",
  surveillanceIndex: "Surveillance",
  hospitalCapacityPct: "Hospital occupancy",
  politicalTensionIndex: "Political tension",
  publicTrustIndex: "Public trust",
  populationHappinessIndex: "Morale",
  mediaPressureIndex: "Media pressure",
  fundRemaining: "Fund",
  ppeDaysRemaining: "PPE days",
  antiviralsRemaining: "Antivirals",
  hcwSurgePct: "HCW surge capacity",
};

// Whether an increase is good for the region. hospitalCapacityPct is
// occupancy (the seeded EVT-011 text: "+3% occupancy"), so up is worse.
export const HIGHER_IS_BETTER: Record<Field, boolean> = {
  rt: false,
  cfrMultiplier: false,
  surveillanceIndex: true,
  hospitalCapacityPct: false,
  politicalTensionIndex: false,
  publicTrustIndex: true,
  populationHappinessIndex: true,
  mediaPressureIndex: false,
  fundRemaining: true,
  ppeDaysRemaining: true,
  antiviralsRemaining: true,
  hcwSurgePct: true,
};

const MINUS = "−";

function fmt(field: Field, v: number): string {
  const sign = v > 0 ? "+" : v < 0 ? MINUS : "";
  const a = Math.abs(v);
  if (field === "fundRemaining") return `${sign}$${(a / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (field === "rt" || field === "cfrMultiplier") return `${sign}${a.toFixed(2)}`;
  if (field === "hospitalCapacityPct" || field === "hcwSurgePct") return `${sign}${a}%`;
  return `${sign}${a.toLocaleString()}`;
}

export function formatEffect(field: Field, lo: number, hi: number): string {
  if (lo === hi) return fmt(field, lo);
  // Smaller magnitude first, sign on both ends so "-7 to -13" can't be
  // misread as running from negative to positive.
  const [a, b] = Math.abs(lo) <= Math.abs(hi) ? [lo, hi] : [hi, lo];
  return `${fmt(field, a)} to ${fmt(field, b)}`;
}

export function isGood(field: Field, delta: number): boolean {
  return delta === 0 ? true : delta > 0 === HIGHER_IS_BETTER[field];
}

// Splits deltas into those that land on the viewing region and those that
// land elsewhere, resolving SELF (the deciding region) and GLOBAL.
export function splitByAudience(deltas: ModelDelta[], ownRegionId: string | null | undefined) {
  const mine: ModelDelta[] = [];
  const world: (ModelDelta & { where: string })[] = [];
  for (const d of deltas) {
    if (d.field === "mediaPressureIndex") {
      world.push({ ...d, where: "Worldwide" });
    } else if (d.region === "SELF") {
      mine.push(d);
    } else if (d.region === "GLOBAL") {
      mine.push(d);
      world.push({ ...d, where: "Every region" });
    } else if (d.region === ownRegionId) {
      mine.push(d);
    } else {
      world.push({ ...d, where: d.region });
    }
  }
  return { mine, world };
}
