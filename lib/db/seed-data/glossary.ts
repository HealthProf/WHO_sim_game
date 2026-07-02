// Plain-language glossary for every piece of jargon used across the
// scenario, decision matrix, and event text (simulation-docs/01-04). Static
// content — no DB table needed. `matchPatterns` are case-insensitive
// substrings used to auto-detect which terms are relevant to a given piece
// of text (see lib/glossary.ts getRelevantGlossaryTerms), so individual
// events don't need to be hand-annotated with a term list that could drift
// out of sync with the narrative copy.

export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  matchPatterns: string[];
}

export const glossaryTerms: GlossaryTerm[] = [
  {
    id: "pheic",
    term: "PHEIC",
    definition:
      "\"Public Health Emergency of International Concern\" — the WHO's highest formal alarm level for an outbreak, declared by the Director-General. It triggers coordinated international response obligations and is a genuinely consequential, closely-watched political act, not just a technical label.",
    matchPatterns: ["PHEIC"],
  },
  {
    id: "ihr-article-12",
    term: "IHR Article 12",
    definition:
      "The section of the International Health Regulations (the treaty governing how countries report and respond to outbreaks) that lays out the process the WHO Director-General must follow to declare a PHEIC, including convening an Emergency Committee of independent experts.",
    matchPatterns: ["Article 12", "IHR Article 12"],
  },
  {
    id: "ihr-article-43",
    term: "IHR Article 43",
    definition:
      "The IHR provision requiring member states to notify WHO and justify any health measures (like travel bans) that go beyond WHO's own recommendations. It exists to stop countries from using health justifications to cover overreaching or discriminatory measures.",
    matchPatterns: ["Article 43"],
  },
  {
    id: "emergency-committee",
    term: "Emergency Committee",
    definition:
      "An independent panel of international experts the WHO Director-General convenes to advise on whether a PHEIC should be declared. Being part of it (or excluded from it) carries real institutional weight in this scenario.",
    matchPatterns: ["Emergency Committee"],
  },
  {
    id: "rt",
    term: "Rt / R0",
    definition:
      "The average number of additional people one infected person infects. R0 is that number with no interventions in place; Rt (\"R-effective\") is the real-time version, which falls as NPIs, vaccination, or immunity kick in. Above 1, the outbreak is still growing; below 1, it's shrinking.",
    matchPatterns: ["Rt", "R0", "reproduction number"],
  },
  {
    id: "cfr",
    term: "CFR (Case Fatality Rate)",
    definition:
      "The share of confirmed cases that result in death. In this scenario each region has a CFR multiplier reflecting local healthcare capacity — the same disease is far deadlier where ICU access is scarce, which is the whole point of the equity-weighted scoring.",
    matchPatterns: ["CFR", "case fatality", "fatality rate"],
  },
  {
    id: "npi",
    term: "NPI (Non-Pharmaceutical Intervention)",
    definition:
      "Any outbreak-control measure that isn't a drug or vaccine — mask mandates, distancing, capacity limits, school closures, etc. Layered combinations of several NPIs are consistently more effective than any single measure alone.",
    matchPatterns: ["NPI", "non-pharmaceutical"],
  },
  {
    id: "covax",
    term: "COVAX",
    definition:
      "A multilateral mechanism for pooling vaccine doses and allocating them by need rather than by who can pay the most or negotiate the best bilateral deal — the equity framework this scenario's vaccine-allocation events are built around.",
    matchPatterns: ["COVAX"],
  },
  {
    id: "surge-capacity",
    term: "HCW Surge Capacity",
    definition:
      "The percentage by which a region could temporarily expand its healthcare workforce in an emergency (recalled retirees, redeployed staff, volunteers). A region offering \"15% surge capacity, 7-day rotation\" is lending trained personnel to another region for a week.",
    matchPatterns: ["surge capacity", "HCW surge", "surge risk"],
  },
  {
    id: "bilateral-deal",
    term: "Bilateral Deal",
    definition:
      "A direct, one-on-one agreement between a single country and a supplier (as opposed to a multilateral mechanism like COVAX). Bilateral vaccine deals are efficient for the country that makes them and are the central tension in the vaccine-nationalism events — they work against pooled, needs-based allocation.",
    matchPatterns: ["bilateral deal", "bilateral cooperation", "bilateral"],
  },
  {
    id: "compassionate-use",
    term: "Compassionate Use",
    definition:
      "Authorization to use a not-yet-fully-approved drug or vaccine outside a clinical trial because the situation is urgent enough to justify it despite incomplete safety/efficacy data — the basis for the early vaccine doses in this scenario.",
    matchPatterns: ["compassionate use", "compassionate-use"],
  },
  {
    id: "detection-rate",
    term: "Detection Rate / Surveillance Index",
    definition:
      "What share of true infections a region's health system actually catches and confirms. A region with a low surveillance index (like SEARO's) has a severe undercount — its confirmed case number is a small fraction of the true outbreak size, which changes what \"good\" NPI timing looks like.",
    matchPatterns: ["surveillance index", "detection rate", "surveillance deficit"],
  },
  {
    id: "genomic-sequence",
    term: "Genomic Sequence / RBD",
    definition:
      "The pathogen's full genetic code, which labs need to design tests, track mutations, and understand transmissibility. \"RBD\" (receptor-binding domain) is the specific part of the virus that lets it attach to human cells — withholding just that piece, as in EVT-002, cripples outside labs' ability to independently verify anything about the virus.",
    matchPatterns: ["genomic sequence", "RBD", "spike protein"],
  },
  {
    id: "escalation-state",
    term: "Escalation State (GREEN / AMBER / RED)",
    definition:
      "The simulation's overall alert level, driven by global Rt and recent Critical Failures. GREEN means monitoring, AMBER means active alert with more frequent events, RED means emergency footing with the heaviest event load and mandatory coordination.",
    matchPatterns: ["escalation state", "GREEN", "AMBER", "RED"],
  },
  {
    id: "media-pressure",
    term: "Media Pressure Index",
    definition:
      "A 0-100 global gauge of how intense public/media scrutiny is. It rises with communication failures and viral misinformation, and falls with transparent, well-handled responses — high values make later communication events fire and intensify.",
    matchPatterns: ["media pressure"],
  },
  {
    id: "political-tension",
    term: "Political Tension Index",
    definition:
      "A 0-100 per-region gauge of strain between your regional office and its member states (or the host government). High values are what trigger events like member-state demands for pre-approval over your public communications.",
    matchPatterns: ["political tension"],
  },
  {
    id: "public-trust",
    term: "Public Trust Index",
    definition:
      "A 0-100 per-region gauge of how much the public trusts official communications. It drops when messaging is inconsistent, delayed, or contradicted by visible non-compliance, and that drop makes future NPI compliance harder to secure.",
    matchPatterns: ["public trust"],
  },
  {
    id: "consequence-tier",
    term: "Consequence Tier",
    definition:
      "Every decision resolves to one of four tiers — Optimal, Adequate, Inadequate, or Critical Failure — based on the composite score. The tier (not the raw score) determines which modelDelta actually gets applied to the live simulation.",
    matchPatterns: ["consequence tier", "Optimal", "Adequate", "Inadequate", "Critical Failure"],
  },
  {
    id: "composite-score",
    term: "Composite Score",
    definition:
      "Evidence-Based Practice (40%) + Political & Economic Realism (30%) + Health Equity (30%), each scored 1-4 by the instructor, combined into a single percentage that determines the consequence tier.",
    matchPatterns: ["composite score", "composite percent", "40/30/30"],
  },
  {
    id: "calibration-wager",
    term: "Confidence Wager",
    definition:
      "You tag Low/Medium/High confidence alongside every decision. It's not scored on whether you were confident — only on whether your confidence matched the outcome. Overconfidence in a bad call costs you more than the bad call alone; flagging genuine uncertainty is never penalized.",
    matchPatterns: ["confidence wager", "calibration"],
  },
  {
    id: "snap-vote",
    term: "Emergency Committee Snap Vote",
    definition:
      "A facilitator-triggered, timed, synchronous vote across all six regions on a single question — separate from the scripted events. Everyone sees only how many regions have responded until it closes, then the full result and its effect are revealed.",
    matchPatterns: ["snap vote", "Emergency Committee vote"],
  },
  {
    id: "resource-pledge",
    term: "Resource Pledge",
    definition:
      "A direct transfer of PPE, funds, antivirals, or HCW surge capacity from your region to another, submitted from the Pledges page. Unlike writing \"we'll help\" in a rationale, this actually moves the numbers on both regions' live ledgers.",
    matchPatterns: ["resource pledge", "pledge"],
  },
  {
    id: "chain-event",
    term: "Chain / Prerequisite Event",
    definition:
      "Some events can't fire until an earlier one is fully resolved for every team it targeted — e.g. the vaccine allocation crisis can't be dispatched until the SEARO data-sharing standoff is scored. This models how real decisions build on each other in sequence.",
    matchPatterns: ["chain event", "prerequisite event", "blocked by"],
  },
  {
    id: "dispatch",
    term: "Dispatch",
    definition:
      "The moment the facilitator releases an event to your team(s) — it appears on your Events page with a deadline, and a private notification appears on your dashboard.",
    matchPatterns: ["dispatch", "dispatched"],
  },
  {
    id: "deadline-types",
    term: "HARD / SOFT / NONE Deadlines",
    definition:
      "HARD: no submission after the window auto-applies a specified fallback tier (usually the worst one). SOFT: you get a reminder partway through, then the same auto-fallback at expiry. NONE: informational only, no decision required.",
    matchPatterns: ["HARD deadline", "SOFT deadline", "deadline window"],
  },
  {
    id: "mandatory-review",
    term: "Mandatory Review",
    definition:
      "Certain especially consequential events (like the vaccine equity crucible) can never be fast-pathed by the instructor — they always require full manual reading and scoring, even if the structured choice suggests an obvious tier.",
    matchPatterns: ["mandatory review"],
  },
  {
    id: "passive-drift",
    term: "Passive Drift",
    definition:
      "Regional Rt creeps upward on its own, slowly, whenever the simulation is running and no fresh containment decision has landed for a while — a reminder that the outbreak doesn't pause just because no event happens to be open.",
    matchPatterns: ["passive drift", "drifts upward"],
  },
  {
    id: "core-path",
    term: "Core Path",
    definition:
      "The facilitator's recommended subset of events for a time-limited session — not something teams need to think about, but if your event feels like it skipped a step, that's why.",
    matchPatterns: ["core path"],
  },
];
