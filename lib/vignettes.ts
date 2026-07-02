// Human-detail vignette lines appended to consequence cards once model
// state crosses certain thresholds after a decision is scored (item 1 of
// the "more memorable session" pass). The mechanical consequencesJson
// prose already says what changed in policy terms ("CFR multiplier +0.6");
// a vignette adds one concrete, human-scale detail for what that actually
// means for someone in the region, which lands harder in the room than
// any index number does. Picked pseudo-randomly from a small pool per
// condition (and pseudo-randomly among matching conditions) so repeat
// crossings don't read identically every time.

interface VignetteState {
  cfrMultiplier: number;
  hcwSurgePct: number;
  publicTrustIndex: number;
  populationHappinessIndex: number;
  hospitalCapacityPct: number;
}

interface VignetteRule {
  id: string;
  condition: (s: VignetteState) => boolean;
  lines: (regionId: string) => string[];
}

const RULES: VignetteRule[] = [
  {
    id: "cfr-spike",
    condition: (s) => s.cfrMultiplier >= 4.5,
    lines: (r) => [
      `A ward physician in ${r} told a local reporter she's now making triage calls she was never trained to make.`,
      `${r}'s largest referral hospital has started turning away non-critical admissions to keep beds free.`,
      `A community health worker in ${r} described this week as "watching the same kind of loss, over and over."`,
    ],
  },
  {
    id: "hospital-capacity",
    condition: (s) => s.hospitalCapacityPct >= 90,
    lines: (r) => [
      `${r}'s main hospital corridor is now lined with overflow beds — a photo of it is circulating on regional social media.`,
      `Ambulance crews in ${r} report waiting over two hours to hand off patients at overcrowded intake.`,
    ],
  },
  {
    id: "hcw-collapse",
    condition: (s) => s.hcwSurgePct <= -5,
    lines: (r) => [
      `Three more nurses resigned from a district hospital in ${r} this week, citing exhaustion.`,
      `A short video of healthcare workers protesting outside a ${r} ministry building has been widely shared.`,
    ],
  },
  {
    id: "trust-floor",
    condition: (s) => s.publicTrustIndex < 30,
    lines: (r) => [
      `A market vendor in ${r}, interviewed on local radio, said flatly: "why would I believe them now?"`,
      `Compliance checkpoints in ${r} are reportedly being ignored by a growing share of commuters.`,
    ],
  },
  {
    id: "happiness-floor",
    condition: (s) => s.populationHappinessIndex < 30,
    lines: (r) => [
      `A small business owner in ${r} posted that this is the third closure order in two months — "there's nothing left to close."`,
      `Local counseling hotlines in ${r} report call volume roughly triple their pre-crisis baseline.`,
    ],
  },
  {
    id: "trust-recovering",
    condition: (s) => s.publicTrustIndex >= 80,
    lines: (r) => [
      `A ${r} community leader publicly thanked the regional office by name at a town hall this week.`,
      `Local coverage in ${r} has shifted from skeptical to cautiously supportive over the last few days.`,
    ],
  },
  {
    id: "happiness-recovering",
    condition: (s) => s.populationHappinessIndex >= 80,
    lines: (r) => [
      `A neighborhood mutual-aid group in ${r} credits the regional office's support for keeping their clinic open.`,
      `${r}'s largest employer publicly praised the regional response in a staff-wide memo that leaked to the press.`,
    ],
  },
];

export function pickVignette(state: VignetteState, regionId: string): string | null {
  const matching = RULES.filter((r) => r.condition(state));
  if (matching.length === 0) return null;
  const rule = matching[Math.floor(Math.random() * matching.length)];
  const lines = rule.lines(regionId);
  return lines[Math.floor(Math.random() * lines.length)];
}
