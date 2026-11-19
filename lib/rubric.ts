// Scoring rubric anchors for the facilitator's scoring screen (Release 2).
// Copied verbatim from simulation-docs/02-decision-matrix.md, which is the
// source of truth; if that document changes, update this file to match.
import type { Tier } from "./scoring";

export const DIMENSIONS = [
  { key: "evidenceScore", label: "Evidence-Based Practice", weight: "40%", measures: "Alignment with WHO/CDC guidelines and epidemiological literature" },
  { key: "politicalScore", label: "Political & Economic Realism", weight: "30%", measures: "Implementation feasibility, stakeholder engagement, legal/political constraints" },
  { key: "equityScore", label: "Health Equity", weight: "30%", measures: "Impact on vulnerable populations and lower-resource regions" },
] as const;

export const TIER_SCALE: { tier: Tier; range: string; score: string }[] = [
  { tier: "OPTIMAL", range: ">= 85%", score: "4/4" },
  { tier: "ADEQUATE", range: "65-84%", score: "3/4" },
  { tier: "INADEQUATE", range: "40-64%", score: "2/4" },
  { tier: "CRITICAL_FAILURE", range: "< 40%", score: "1/4" },
];

export const CATEGORY_RUBRICS: Record<string, Record<Tier, string>> = {
  "Travel & Border Restrictions": {
    OPTIMAL: "Risk-stratified measures proportional to transmission data; time-bound with sunset clause; exemptions for humanitarian/medical corridors and health workers; advance notice to affected states",
    ADEQUATE: "Standard entry screening, targeted at highest-risk corridors; documented but may lack sunset clause or equity provisions",
    INADEQUATE: "Blanket restrictions without epidemiological justification, OR significant implementation delay; disproportionately burdens low-income travelers/humanitarian ops without mitigation",
    CRITICAL_FAILURE: "No action despite clear evidence, OR measures that actively accelerate spread (e.g., forced mass movement)",
  },
  "Quarantine & Isolation Protocols": {
    OPTIMAL: "Duration calibrated to incubation period; voluntary-compliance mechanisms; material support for isolated individuals; clear entry/exit criteria",
    ADEQUATE: "Standard quarantine, reasonable duration; support provisions inconsistent; voluntary compliance primary mechanism",
    INADEQUATE: "Duration misaligned with incubation period; no support provisions; inconsistent enforcement",
    CRITICAL_FAILURE: "No protocols despite community transmission, OR protocol design that concentrates cases (e.g., co-housing exposed and confirmed)",
  },
  "Vaccine & Therapeutic Distribution": {
    OPTIMAL: "Prioritizes high-transmission AND high-vulnerability populations; addresses cold-chain feasibility in low-resource regions; explicit burden-sharing mechanism; all regions consulted; no region gets zero without agreement+compensation",
    ADEQUATE: "Reasonable priority criteria but may over-weight politically/economically powerful regions; some equity provisions but not central",
    INADEQUATE: "Allocation based on ability-to-pay/political relationships over need; high-burden low-resource regions systematically under-served",
    CRITICAL_FAILURE: "One or more regions receive zero allocation with no mitigation offered, OR doses allowed to expire due to distribution failure",
  },
  "Surveillance & Data Sharing": {
    OPTIMAL: "Real-time sharing via coordinated platform; genomic data open within 24-72h; governance framework agreed by all parties; capacity-building support to weaker-surveillance regions",
    ADEQUATE: "Shared with 24-48h delay; genomic data shared but not real-time; basic governance in place",
    INADEQUATE: "Sharing delayed >72h, incomplete, or conditional on political negotiation; genomic data not shared internationally",
    CRITICAL_FAILURE: "Deliberate withholding, misrepresentation of case counts, or refusal to participate in coordination",
  },
  "Non-Pharmaceutical Interventions (NPIs)": {
    OPTIMAL: "Layered bundle (4+ measures) proportional to current transmission; clear communication with defined review intervals; explicit equity provisions (mask access, economic support)",
    ADEQUATE: "Reasonable bundle (2-3 measures); adequate communication; limited equity provisions",
    INADEQUATE: "Too-late or too-early implementation; single-measure when layered response warranted; no equity provisions",
    CRITICAL_FAILURE: "No NPIs during active community transmission, OR actively counterproductive measures",
  },
  "International Aid & Funding Requests": {
    OPTIMAL: "Need-based, evidence-justified requests/allocation; transparent accountability mechanism; proactive aid offers to lower-resource regions; no problematic conditionalities",
    ADEQUATE: "Reasonable and mostly justified; accountability present but not detailed; allocation reasonably but not optimally equitable",
    INADEQUATE: "Requested/allocated without clear justification; directed to politically-favored over highest-need recipients; impeding conditionalities",
    CRITICAL_FAILURE: "Refusal to engage with aid mechanisms during declared emergency, OR diversion of earmarked funds, OR bad-faith requests",
  },
  "Public Communication & Risk Messaging": {
    OPTIMAL: "Timely (within 24h); transparent about uncertainty; culturally/linguistically adapted; delivered via trusted channels; actively counters misinformation; two-way feedback mechanisms",
    ADEQUATE: "Timely and accurate but lacks cultural adaptation or equity provisions; one-directional broadcast only",
    INADEQUATE: "Delayed >48h; factually inconsistent or uninformatively hedged; misinformation unaddressed; single-channel excluding population segments",
    CRITICAL_FAILURE: "Deliberate misinformation by regional authority, communication blackout during active outbreak, or messaging that discourages protective behavior",
  },
};

// Event categories are free text like "Surveillance & Data Sharing /
// Institutional Authority". Returns every part that has a rubric in the
// decision matrix, plus the parts that don't (e.g. "Institutional
// Authority", which the matrix doesn't define a table for).
const ALIASES: Record<string, string> = {
  NPIs: "Non-Pharmaceutical Interventions (NPIs)",
  "Non-Pharmaceutical Interventions": "Non-Pharmaceutical Interventions (NPIs)",
  "International Aid & Funding": "International Aid & Funding Requests",
  "International Aid": "International Aid & Funding Requests",
  "Public Communication": "Public Communication & Risk Messaging",
};

export function rubricsForCategory(category: string): { matched: { name: string; tiers: Record<Tier, string> }[]; unmatched: string[] } {
  const matched: { name: string; tiers: Record<Tier, string> }[] = [];
  const unmatched: string[] = [];
  for (const raw of category.split("/").map((p) => p.trim()).filter(Boolean)) {
    const name = CATEGORY_RUBRICS[raw] ? raw : ALIASES[raw];
    if (name && CATEGORY_RUBRICS[name]) {
      if (!matched.some((m) => m.name === name)) matched.push({ name, tiers: CATEGORY_RUBRICS[name] });
    } else unmatched.push(raw);
  }
  return { matched, unmatched };
}
