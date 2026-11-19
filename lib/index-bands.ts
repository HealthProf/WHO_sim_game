// Labeled bands for the 0-100 social indices (Release 1), so teams can read
// "62" as "Fair" at a glance and know where the next consequence kicks in.
//
// The cut points are not arbitrary: they're the thresholds the simulation
// already acts on, so a band change always means something in play.
// - Public trust / population happiness: the warning-arc events fire below
//   45, 30 and 15 (EVT-017..022 trigger conditions in
//   lib/db/seed-data/events.ts); the reward milestones are at 80 and 92
//   (lib/social-thresholds.ts).
// - Political tension (lower is better): escalation events fire above 60, 75
//   and 90 (EVT-023..025); 90 or more also locks the region out of WHO HQ
//   purchases and emergency funding (POLITICAL_TENSION_LOCKOUT_THRESHOLD);
//   calm milestones at 25 and 10.
// - Media pressure: EVT-010 fires above 65.
//
// Pure (no DB) so client components can use it.

export type IndexMetric = "publicTrust" | "happiness" | "politicalTension" | "mediaPressure";

export interface Band {
  label: string;
  // 0 = best .. 4 = worst, drives the bar tint; the label always carries
  // the meaning too, so color is never the only signal.
  severity: 0 | 1 | 2 | 3 | 4;
  min: number; // inclusive
  max: number; // inclusive
  note: string;
}

const HIGHER_IS_BETTER = (noun: string): Band[] => [
  { label: "Critical", severity: 4, min: 0, max: 14, note: `Severe ${noun} crisis; worst warning events fire below 15.` },
  { label: "Very poor", severity: 3, min: 15, max: 29, note: "Second warning level; below 15 is a crisis." },
  { label: "Poor", severity: 2, min: 30, max: 44, note: "First warning events fire below 45." },
  { label: "Fair", severity: 1, min: 45, max: 79, note: "Stable. Reaching 80 earns a bonus." },
  { label: "Good", severity: 0, min: 80, max: 91, note: "Bonus milestone reached; 92 earns another." },
  { label: "Strong", severity: 0, min: 92, max: 100, note: "Top milestone reached." },
];

export const BANDS: Record<IndexMetric, Band[]> = {
  publicTrust: HIGHER_IS_BETTER("trust"),
  happiness: HIGHER_IS_BETTER("public morale"),
  politicalTension: [
    { label: "Very calm", severity: 0, min: 0, max: 10, note: "Top calm milestone." },
    { label: "Calm", severity: 0, min: 11, max: 25, note: "Calm milestone reached." },
    { label: "Moderate", severity: 1, min: 26, max: 60, note: "Escalation events start above 60." },
    { label: "High", severity: 2, min: 61, max: 75, note: "First escalation level; next above 75." },
    { label: "Severe", severity: 3, min: 76, max: 89, note: "At 90 you lose access to WHO HQ purchases and emergency funding." },
    { label: "Lockout", severity: 4, min: 90, max: 100, note: "Can't buy from WHO HQ or request emergency funding until tension falls below 90." },
  ],
  mediaPressure: [
    { label: "Low", severity: 0, min: 0, max: 34, note: "Little media scrutiny." },
    { label: "Elevated", severity: 2, min: 35, max: 65, note: "A media-crisis event fires above 65." },
    { label: "High", severity: 4, min: 66, max: 100, note: "Media crisis territory." },
  ],
};

export const METRIC_LABEL: Record<IndexMetric, string> = {
  publicTrust: "Public trust",
  happiness: "Population happiness",
  politicalTension: "Political tension",
  mediaPressure: "Media pressure",
};

export const HIGHER_IS_WORSE: Record<IndexMetric, boolean> = {
  publicTrust: false,
  happiness: false,
  politicalTension: true,
  mediaPressure: true,
};

export function bandFor(metric: IndexMetric, value: number): Band {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const bands = BANDS[metric];
  return bands.find((b) => v >= b.min && v <= b.max) ?? bands[bands.length - 1];
}
