// Seeded from simulation-docs/03-events.md. modelDeltaJson tiers apply to the
// submitting team's own region ("SELF") unless a specific region code is given,
// or "GLOBAL" for global_state fields (media_pressure_index, escalation only).
// These are a faithful-but-implementable encoding of each event's `modelDelta`
// prose in 03-events.md — see modelDeltaDesc for the authoritative narrative text.

export type Tier = "OPTIMAL" | "ADEQUATE" | "INADEQUATE" | "CRITICAL_FAILURE";

export interface ModelDelta {
  field:
    | "rt"
    | "cfrMultiplier"
    | "surveillanceIndex"
    | "hospitalCapacityPct"
    | "politicalTensionIndex"
    | "publicTrustIndex"
    | "populationHappinessIndex"
    | "mediaPressureIndex"
    | "fundRemaining"
    | "ppeDaysRemaining"
    | "antiviralsRemaining"
    | "hcwSurgePct";
  region: "SELF" | "GLOBAL" | "AFRO" | "AMRO" | "EMRO" | "EURO" | "SEARO" | "WPRO";
  delta: number;
}

// Concrete resource cost of picking a structured option — deducted from the
// submitting team's own ledger immediately at submission time (not at
// scoring), since "how much this path costs" is a property of the choice
// itself, independent of how well it's later judged to have been executed.
// Also drives the affordability gating on the event form (item 4 — a team
// can't select an option it can't currently afford) and the "impact on your
// dashboard" text shown for every option (item 1).
export interface OptionCost {
  fund?: number;
  ppeDays?: number;
  antivirals?: number;
}

export interface StructuredOption {
  label: string;
  text: string;
  suggestedTier: Tier;
  cost?: OptionCost;
  impactDesc: string; // plain-language "what this costs / what it changes" shown to teams
}

export interface EventSeed {
  id: string;
  title: string;
  day: number;
  category: string;
  deadlineType: "HARD" | "SOFT" | "NONE";
  deadlineWindowHours: number | null;
  reminderAtHours: number | null;
  deadlineWindowDesc: string;
  scope: "GLOBAL" | "REGIONAL" | "MULTI";
  isAnchor: boolean;
  narrativeMarkdown: string;
  decisionPromptMarkdown: string;
  minRationaleWords: number;
  structuredOptionsJson: StructuredOption[] | null;
  triggerConditionDesc: string;
  consequencesJson: { optimal: string; adequate: string; inadequate: string; critical: string };
  modelDeltaDesc: string;
  modelDeltaJson: Record<Tier, ModelDelta[]>;
  noResponseFallbackTier: Tier;
  requiresMandatoryReview: boolean;
  requiresCoordination: boolean;
  isAllocationEvent: boolean;
  chainPrev: string[];
  // Recommended lean spine for a ~60-minute live session (see the Control
  // page's core/optional filter) — advisory only, never blocks dispatch.
  // Core: the anchors plus the equity/solidarity throughline (PHEIC -> SEARO
  // data -> NPI -> vaccine equity crucible -> AFRO healthcare surge -> second
  // tranche -> trajectory briefing -> IHR reform -> close). Optional: the
  // secondary conflict/media/politics beats, worth running if time allows.
  isCorePath: boolean;
  // Pre-fills the Control page's dispatch region picker. null = suggest all
  // six (the common case, including events whose narrative names a "primary"
  // region but whose decision prompt explicitly asks every team to respond,
  // e.g. EVT-003/EVT-005/EVT-008/EVT-011). A concrete list means 03-events.md
  // names a genuinely restricted audience (e.g. EVT-002: SEARO/WPRO/EURO).
  // EVT-009/EVT-013 are also restricted in the source design but the actual
  // target set depends on live scores, so they're left null here (no sane
  // static default) and the instructor picks regions manually at dispatch
  // time — the Control page prompts for this on every dispatch.
  suggestedTargetRegions: string[] | null;
}

export const eventSeed: EventSeed[] = [
  {
    id: "EVT-001",
    isCorePath: true,
    suggestedTargetRegions: null,
    title: "PHEIC Declaration",
    day: 1,
    category: "Surveillance & Data Sharing / Institutional Authority",
    deadlineType: "HARD",
    deadlineWindowHours: 2,
    reminderAtHours: null,
    deadlineWindowDesc: "2-hour window",
    scope: "GLOBAL",
    isAnchor: true,
    narrativeMarkdown:
      "The WHO DG has convened the Emergency Committee under IHR Article 12 following confirmed human-to-human transmission in 3 countries across 2 regions. 128 confirmed cases, 6 deaths, true count estimated 8-15x higher. The SEARO host government has requested WHO avoid the word \"outbreak\" publicly.",
    decisionPromptMarkdown:
      "Submit your formal position on PHEIC declaration: (1) are Article 12 criteria met, (2) recommended declaration language, (3) position on SEARO's terminology request.",
    minRationaleWords: 200,
    structuredOptionsJson: [
      {
        label: "A",
        text: "Declare PHEIC immediately, standard language — economics irrelevant to Article 12.",
        suggestedTier: "OPTIMAL",
        cost: { fund: 300_000 },
        impactDesc: "Costs $300K to mobilize the Emergency Committee's formal declaration process (legal drafting, translation, member-state notification). No PPE/antiviral impact.",
      },
      {
        label: "B",
        text: "Declare but with modified language acknowledging economic impact.",
        suggestedTier: "ADEQUATE",
        cost: { fund: 150_000 },
        impactDesc: "Costs $150K in legal drafting for the modified language — cheaper than A, but the hedged wording is what keeps this at Adequate rather than Optimal.",
      },
      {
        label: "C",
        text: "Delay 48h to gather additional case/transmission data before deciding.",
        suggestedTier: "INADEQUATE",
        cost: {},
        impactDesc: "No direct cost — but every hour of delay is an hour of undetected transmission continuing unchecked, and it hands EURO an opening to act unilaterally before WHO has spoken.",
      },
      {
        label: "D",
        text: "Abstain pending full member-state consultation.",
        suggestedTier: "INADEQUATE",
        cost: {},
        impactDesc: "No direct cost — but WHO has no formal voice in the Emergency Committee's first session, and the vacuum gets filled by whoever moves first.",
      },
    ],
    triggerConditionDesc: "Anchor, fires at simulation open (08:00 Day 1)",
    consequencesJson: {
      optimal: "A with evidence-based rationale — PHEIC declared, +legitimacy, SEARO pressure accelerates.",
      adequate: "A or B reasonable — PHEIC declared, minor tension if B.",
      inadequate: "C or D — PHEIC delayed 24h, global Rt +0.06, EURO starts unilateral measures early (triggers EVT-003 early).",
      critical: "No response — loses Emergency Committee voice for Day 1.",
    },
    modelDeltaDesc:
      "PHEIC declared -> detection rate +15% all regions. Delayed -> EVT-003 fires 12h early.",
    modelDeltaJson: {
      OPTIMAL: [{ field: "surveillanceIndex", region: "GLOBAL", delta: 1 }],
      ADEQUATE: [{ field: "surveillanceIndex", region: "GLOBAL", delta: 1 }],
      INADEQUATE: [{ field: "rt", region: "GLOBAL", delta: 0.06 }],
      CRITICAL_FAILURE: [{ field: "rt", region: "GLOBAL", delta: 0.1 }],
    },
    noResponseFallbackTier: "CRITICAL_FAILURE",
    requiresMandatoryReview: false,
    requiresCoordination: false,
    isAllocationEvent: false,
    chainPrev: [],
  },
  {
    id: "EVT-002",
    isCorePath: true,
    suggestedTargetRegions: ["SEARO", "WPRO", "EURO"],
    title: "SEARO Data-Sharing Standoff",
    day: 1,
    category: "Surveillance & Data Sharing",
    deadlineType: "SOFT",
    deadlineWindowHours: 4,
    reminderAtHours: 2,
    deadlineWindowDesc: "4h window; reminder at 2h",
    scope: "MULTI",
    isAnchor: false,
    narrativeMarkdown:
      "SEARO's deposited genomic sequence is missing the spike protein RBD, citing \"biosecurity concerns.\" WPRO states threaten a 24h border closure without full data. EURO's chief scientific adviser calls the redaction \"scientifically indefensible.\"",
    decisionPromptMarkdown:
      "SEARO responds to WHO's data request; WPRO/EURO submit formal position + any actions considered.",
    minRationaleWords: 150,
    structuredOptionsJson: [
      {
        label: "A",
        text: "Release the full genomic sequence, including the RBD, to all international labs immediately.",
        suggestedTier: "OPTIMAL",
        cost: { fund: 200_000 },
        impactDesc: "Costs $200K for rapid re-sequencing/verification before public release. Fastest path to restoring outside labs' ability to independently validate anything about the pathogen.",
      },
      {
        label: "B",
        text: "Controlled release: full sequence shared confidentially with WHO reference labs only, not published publicly.",
        suggestedTier: "ADEQUATE",
        cost: { fund: 100_000 },
        impactDesc: "Costs $100K in secure-transfer/confidentiality-agreement overhead. Satisfies the technical need faster than a public release would, but the secrecy itself keeps drawing scrutiny.",
      },
      {
        label: "C",
        text: "Decline to release pending a national biosecurity review, estimated at 72 hours.",
        suggestedTier: "INADEQUATE",
        cost: {},
        impactDesc: "No direct cost — but WPRO's 24-hour border-closure threat is real, and every hour of continued redaction adds to the \"proof\" the misinformation campaign later cites.",
      },
      {
        label: "D",
        text: "Request WHO convene formal mediation between SEARO and the states threatening border closure before deciding.",
        suggestedTier: "INADEQUATE",
        cost: { fund: 50_000 },
        impactDesc: "Costs $50K to convene mediation. Buys a little goodwill for process, but doesn't get the sequence into anyone's hands any faster than outright refusal.",
      },
    ],
    triggerConditionDesc: "Adaptive, fires 3h after EVT-001 resolves.",
    consequencesJson: {
      optimal: "A/B, sequence shared <24h — surveillance index +2, WPRO closure averted.",
      adequate: "B with reasonable timeline, partial release <48h.",
      inadequate: "C/D, withheld 72h — global detection rate down, WPRO closure triggers early, EURO files IHR complaint.",
      critical: "No response — treated as C + DG public statement on non-compliance.",
    },
    modelDeltaDesc: "Full release -> global detection +20%, vaccine timeline -1 day. Refusal -> global detection -10% for 72h, WPRO Rt +0.08.",
    modelDeltaJson: {
      OPTIMAL: [{ field: "surveillanceIndex", region: "SELF", delta: 2 }],
      ADEQUATE: [{ field: "surveillanceIndex", region: "SELF", delta: 1 }],
      INADEQUATE: [
        { field: "surveillanceIndex", region: "GLOBAL", delta: -1 },
        { field: "rt", region: "WPRO", delta: 0.08 },
      ],
      CRITICAL_FAILURE: [
        { field: "surveillanceIndex", region: "GLOBAL", delta: -2 },
        { field: "rt", region: "WPRO", delta: 0.08 },
      ],
    },
    noResponseFallbackTier: "INADEQUATE",
    requiresMandatoryReview: false,
    requiresCoordination: false,
    isAllocationEvent: false,
    chainPrev: ["EVT-001"],
  },
  {
    id: "EVT-003",
    isCorePath: true,
    suggestedTargetRegions: null,
    title: "EURO Unilateral Travel Ban / IHR Article 43 Challenge",
    day: 2,
    category: "Travel & Border Restrictions",
    deadlineType: "SOFT",
    deadlineWindowHours: 5,
    reminderAtHours: 3,
    deadlineWindowDesc: "5h window; reminder at 3h",
    scope: "MULTI",
    isAnchor: false,
    narrativeMarkdown:
      "3 EURO states impose blanket travel bans exceeding WHO guidance. SEARO files a formal Article 43 protest. G7 Health Ministers publicly endorse the bans, contradicting WHO. MSF warns of medical supply chain disruption to SEARO.",
    decisionPromptMarkdown:
      "EURO responds to Article 43 obligation + justifies measures. SEARO submits formal protest + any retaliatory/diplomatic response. Other teams state a position on whether WHO should publicly challenge EURO.",
    minRationaleWords: 150,
    structuredOptionsJson: [
      {
        label: "A",
        text: "File full Article 43 notification with epidemiological justification; maintain the blanket bans as-is.",
        suggestedTier: "ADEQUATE",
        cost: { fund: 500_000 },
        impactDesc: "Costs $500K in legal/administrative notification overhead. Respects IHR process, but the underlying measures are still broader than the evidence supports.",
      },
      {
        label: "B",
        text: "Replace the blanket bans with risk-based entry screening at high-transit points, per WHO guidance, with a defined sunset clause.",
        suggestedTier: "OPTIMAL",
        cost: { fund: 1_200_000 },
        impactDesc: "Costs $1.2M to stand up screening infrastructure (testing stations, staff, humanitarian-corridor exemptions) — more expensive than just keeping the bans, but it's the only option that actually resolves MSF's supply-chain concern.",
      },
      {
        label: "C",
        text: "Maintain the bans and decline to file Article 43 notification, citing sovereign authority over border policy.",
        suggestedTier: "INADEQUATE",
        cost: {},
        impactDesc: "No direct cost — but this is a formal IHR violation, and AFRO's supply chain (routed through EURO) takes the collateral damage.",
      },
    ],
    triggerConditionDesc: "Adaptive. Nominal 08:00 Day 2; early trigger (20:00 Day 1) if EVT-001 delayed or EVT-002 refused.",
    consequencesJson: {
      optimal: "B — measures aligned with guidance, tension reduced, MSF concern resolved.",
      adequate: "A — bans maintained but process respected.",
      inadequate: "C — IHR violation, SEARO instability event, SEARO cooperation -1 tier, global Rt +0.04.",
      critical: "Non-response/active refusal — IHR compliance review, EURO loses 1 Emergency Committee vote-weight, diplomatic cascade.",
    },
    modelDeltaDesc: "Option B -> SEARO Rt -0.03. Option C/non-response -> SEARO Rt +0.06, AFRO Rt +0.03 (supply chain), global detection -5%.",
    modelDeltaJson: {
      OPTIMAL: [{ field: "rt", region: "SEARO", delta: -0.03 }],
      ADEQUATE: [],
      INADEQUATE: [
        { field: "rt", region: "SEARO", delta: 0.06 },
        { field: "rt", region: "AFRO", delta: 0.03 },
        { field: "surveillanceIndex", region: "GLOBAL", delta: -1 },
      ],
      CRITICAL_FAILURE: [
        { field: "rt", region: "SEARO", delta: 0.06 },
        { field: "rt", region: "AFRO", delta: 0.03 },
        { field: "politicalTensionIndex", region: "SELF", delta: 10 },
      ],
    },
    noResponseFallbackTier: "ADEQUATE",
    requiresMandatoryReview: false,
    requiresCoordination: false,
    isAllocationEvent: false,
    chainPrev: ["EVT-001"],
  },
  {
    id: "EVT-004",
    isCorePath: true,
    suggestedTargetRegions: null,
    title: "NPI Decision (Regional)",
    day: 2,
    category: "Non-Pharmaceutical Interventions",
    deadlineType: "SOFT",
    deadlineWindowHours: 6,
    reminderAtHours: 3,
    deadlineWindowDesc: "6h window; reminder at 3h",
    scope: "REGIONAL",
    isAnchor: false,
    narrativeMarkdown:
      "WHO advisory requests NPI implementation plans within 8h. Region-specific Rt data included. Containment window estimated 72-96h.",
    decisionPromptMarkdown:
      "Submit an NPI plan: (1) measures selected, (2) implementation timeline, (3) communication strategy, (4) equity provisions. Select all measures that apply: mask mandate, physical distancing, venue capacity limits, school measures, workplace guidance, mass gathering restrictions, hand hygiene infrastructure, targeted high-risk-setting measures.",
    minRationaleWords: 250,
    structuredOptionsJson: [
      {
        label: "LAYERED",
        text: "Full layered bundle: mask mandate + physical distancing + venue capacity limits + mass-gathering restrictions, paired with wage-replacement support for affected workers and hygiene-infrastructure investment (hand-washing stations, ventilation upgrades in high-risk settings).",
        suggestedTier: "OPTIMAL",
        cost: { fund: 3_000_000, ppeDays: 5 },
        impactDesc: "Costs $3.0M (wage-replacement support + hygiene infrastructure) and draws down 5 days of PPE stock (mask distribution). The largest single Rt lever in the simulation (−15 to −25%), but it's visibly disruptive to daily life and the most expensive option on the table.",
      },
      {
        label: "MODERATE",
        text: "Moderate bundle: mask mandate + venue capacity limits, backed by a public information campaign, but no dedicated wage-replacement or equity support.",
        suggestedTier: "ADEQUATE",
        cost: { fund: 900_000 },
        impactDesc: "Costs $900K (campaign + limited enforcement). Meaningfully slows transmission (Rt −8 to −14%) at a fraction of the Layered bundle's cost, but with no equity provisions it falls hardest on workers who can't avoid crowded settings.",
      },
      {
        label: "MINIMAL",
        text: "A single non-mandatory measure (mask advisory only), implemented after a 48-hour consultation delay.",
        suggestedTier: "INADEQUATE",
        cost: { fund: 150_000 },
        impactDesc: "Costs only $150K and preserves near-term political capital — but a single non-mandatory measure implemented late has minimal epidemiological effect, and it's what sets up the compliance-collapse risk later in the week.",
      },
      {
        label: "NONE",
        text: "No new measures beyond existing guidance; defer to member states.",
        suggestedTier: "CRITICAL_FAILURE",
        cost: {},
        impactDesc: "No cost, no disruption to anyone right now — but Rt continues climbing unchecked, and this is the single most reliable path to triggering a healthcare capacity surge in your region within days.",
      },
    ],
    triggerConditionDesc: "Adaptive — fires when global Rt stays above 3.5 for 12+ hours, or automatically Day 2 afternoon.",
    consequencesJson: {
      optimal: "Layered bundle (4+) + equity provisions — Rt -15-25%.",
      adequate: "Moderate bundle (2-3) + some equity — Rt -8-14%.",
      inadequate: "1-2 measures, delayed, no equity — minimal impact, sets up EVT-009.",
      critical: "No measures / counterproductive — Rt escalates, triggers healthcare surge on Day 3.",
    },
    modelDeltaDesc: "Applied per-region. SEARO/AMRO highest baseline Rt -> largest absolute global impact from their NPI choices.",
    modelDeltaJson: {
      OPTIMAL: [{ field: "rt", region: "SELF", delta: -0.2 }],
      ADEQUATE: [{ field: "rt", region: "SELF", delta: -0.11 }],
      INADEQUATE: [{ field: "rt", region: "SELF", delta: 0.02 }],
      CRITICAL_FAILURE: [{ field: "rt", region: "SELF", delta: 0.15 }],
    },
    noResponseFallbackTier: "INADEQUATE",
    requiresMandatoryReview: false,
    requiresCoordination: false,
    isAllocationEvent: false,
    chainPrev: [],
  },
  {
    id: "EVT-005",
    isCorePath: true,
    suggestedTargetRegions: null,
    title: "Healthcare Worker Exposure / PPE Shortage",
    day: 2,
    category: "International Aid & Funding / Healthcare Resource Allocation",
    deadlineType: "SOFT",
    deadlineWindowHours: 5,
    reminderAtHours: 3,
    deadlineWindowDesc: "5h window; reminder at 3h",
    scope: "MULTI",
    isAnchor: false,
    narrativeMarkdown:
      "SEARO reports 14+ confirmed HCW infections due to PPE shortage (linked to EURO travel-ban supply disruption). A whistleblower physician alleges concealment of true HCW infection numbers. EMRO has a parallel, less acute shortage.",
    decisionPromptMarkdown:
      "SEARO submits an emergency resource request. EMRO states its position on sharing own limited stock. All others indicate contribution + any conditions.",
    minRationaleWords: 150,
    structuredOptionsJson: [
      {
        label: "A",
        text: "Full solidarity — contribute a meaningful share of your regional PPE stock to SEARO, no conditions attached.",
        suggestedTier: "OPTIMAL",
        cost: { ppeDays: 4 },
        impactDesc: "Costs 4 days of your own PPE stock, transferred to SEARO with no strings attached. The biggest dent in your own reserve of any option here — a real bet that solidarity now is worth the exposure risk to your own frontline staff later.",
      },
      {
        label: "B",
        text: "Conditional contribution — a smaller share of PPE stock, with accountability reporting attached.",
        suggestedTier: "ADEQUATE",
        cost: { ppeDays: 2 },
        impactDesc: "Costs 2 days of your own PPE stock. Half the exposure of full solidarity, but the reporting conditions slow down how fast SEARO can actually use it.",
      },
      {
        label: "C",
        text: "Decline to contribute PPE; offer technical/logistics support instead (supply-chain expertise, not physical stock).",
        suggestedTier: "INADEQUATE",
        cost: { fund: 200_000 },
        impactDesc: "Costs $200K in technical support instead of any PPE — keeps your own stock fully intact, but SEARO's actual shortage (physical masks and gowns) doesn't get any smaller.",
      },
      {
        label: "D",
        text: "No response.",
        suggestedTier: "CRITICAL_FAILURE",
        cost: {},
        impactDesc: "No cost — and no help. SEARO's healthcare workers keep working exposed while this option costs your region nothing.",
      },
    ],
    triggerConditionDesc: "Adaptive — fires when SEARO Rt > 3.8 AND SEARO PPE stock < 15 days, or automatically at 17:00 Day 2.",
    consequencesJson: {
      optimal: "Majority choose A/B — SEARO stabilized, HCW infections contained.",
      adequate: "Mixed response — partial stabilization.",
      inadequate: "Majority decline — SEARO HCW infections accelerate, triggers healthcare surge Day 3.",
      critical: "No contributions + no communication response — SEARO capacity drops 1 tier.",
    },
    modelDeltaDesc: "Full solidarity -> SEARO CFR multiplier -0.4. Majority decline -> SEARO CFR multiplier +0.6.",
    modelDeltaJson: {
      OPTIMAL: [{ field: "cfrMultiplier", region: "SEARO", delta: -0.4 }],
      ADEQUATE: [{ field: "cfrMultiplier", region: "SEARO", delta: -0.15 }],
      INADEQUATE: [{ field: "cfrMultiplier", region: "SEARO", delta: 0.4 }],
      CRITICAL_FAILURE: [{ field: "cfrMultiplier", region: "SEARO", delta: 0.6 }],
    },
    noResponseFallbackTier: "CRITICAL_FAILURE",
    requiresMandatoryReview: false,
    requiresCoordination: false,
    isAllocationEvent: false,
    chainPrev: [],
  },
  {
    id: "EVT-006",
    isCorePath: true,
    suggestedTargetRegions: null,
    title: "Early-Access Vaccine Allocation (\"The Equity Crucible\")",
    day: 3,
    category: "Vaccine & Therapeutic Distribution",
    deadlineType: "HARD",
    deadlineWindowHours: 4,
    reminderAtHours: null,
    deadlineWindowDesc: "4-hour window, no extension",
    scope: "GLOBAL",
    isAnchor: true,
    narrativeMarkdown:
      "A pharma consortium releases 240,000 compassionate-use doses (71% efficacy vs. severe disease, Phase 2 data only). COVAX secures 180,000 for WHO allocation; the remaining 60,000 were pre-purchased bilaterally by AMRO's largest member state and are not available for multilateral allocation. MSF publicly warns against politically-influenced allocation.",
    decisionPromptMarkdown:
      "Submit your proposed allocation of the 180,000 doses across all six regions (must sum to 180,000). Justify against all three scoring dimensions. Inter-regional negotiation is permitted and encouraged during the window — use the coordination log.",
    minRationaleWords: 200,
    structuredOptionsJson: null,
    triggerConditionDesc: "Anchor, fires 08:00 Day 3 regardless of model state. The simulation's central equity event.",
    consequencesJson: {
      optimal: "Prioritizes AFRO/SEARO by CFR multiplier + HCW need — global CFR trajectory -10-15%, MSF positive statement.",
      adequate: "Partial equity orientation — moderate CFR improvement.",
      inadequate: "Allocation reflects political/economic weight over need — AFRO/SEARO under-served, AFRO CFR event fires Day 4.",
      critical: "AFRO gets ~zero with no justification — equity collapse event, AFRO CFR to max tier, DG emergency statement, mandatory facilitator review.",
    },
    modelDeltaDesc: "Optimal COVAX-aligned -> AFRO CFR multiplier -0.8, SEARO -0.5. Needs-blind allocation -> AFRO CFR multiplier +1.2 (largest single model impact in the simulation).",
    modelDeltaJson: {
      OPTIMAL: [
        { field: "cfrMultiplier", region: "AFRO", delta: -0.8 },
        { field: "cfrMultiplier", region: "SEARO", delta: -0.5 },
      ],
      ADEQUATE: [
        { field: "cfrMultiplier", region: "AFRO", delta: -0.3 },
        { field: "cfrMultiplier", region: "SEARO", delta: -0.2 },
      ],
      INADEQUATE: [{ field: "cfrMultiplier", region: "AFRO", delta: 0.5 }],
      CRITICAL_FAILURE: [
        { field: "cfrMultiplier", region: "AFRO", delta: 1.2 },
        { field: "publicTrustIndex", region: "GLOBAL", delta: -10 },
      ],
    },
    noResponseFallbackTier: "CRITICAL_FAILURE",
    requiresMandatoryReview: true,
    requiresCoordination: true,
    isAllocationEvent: true,
    chainPrev: ["EVT-002"],
  },
  {
    id: "EVT-007",
    isCorePath: false,
    suggestedTargetRegions: null,
    title: "MSF Open Letter",
    day: 3,
    category: "Public Communication & Risk Messaging",
    deadlineType: "SOFT",
    deadlineWindowHours: 3,
    reminderAtHours: 1.5,
    deadlineWindowDesc: "3h window for a joint response; independent responses if no agreement count as Option D",
    scope: "GLOBAL",
    isAnchor: false,
    narrativeMarkdown:
      "Content branches on EVT-006's outcome: if Optimal, MSF's statement is positive/commendatory; if Inadequate/Critical, MSF publishes an accusatory open letter (\"WHO's Vaccine Apartheid\") that goes viral, and the Media Pressure Index spikes to its simulation peak.",
    decisionPromptMarkdown:
      "Teams must agree on ONE joint WHO response within 3 hours (inter-regional coordination required via the coordination log). If no agreement, independent responses count as a coordination failure.",
    minRationaleWords: 150,
    structuredOptionsJson: [
      {
        label: "A",
        text: "Joint acknowledgment — accept the equity shortfall publicly and commit to a specific, revised allocation framework for the next tranche.",
        suggestedTier: "OPTIMAL",
        cost: { fund: 400_000 },
        impactDesc: "Costs $400K to draft and coordinate the revised framework document across all six regions. The most expensive communication option here, but it's the only one that gives EVT-012 a concrete commitment to be held to.",
      },
      {
        label: "B",
        text: "Joint rebuttal — defend the original allocation and reject MSF's characterization.",
        suggestedTier: "INADEQUATE",
        cost: { fund: 250_000 },
        impactDesc: "Costs $250K in legal/communications defense. Cheaper than acknowledging fault, but defending an allocation MSF has already publicly criticized tends to intensify coverage rather than end it.",
      },
      {
        label: "C",
        text: "Partial acknowledgment — note the concern without a specific corrective commitment.",
        suggestedTier: "ADEQUATE",
        cost: { fund: 150_000 },
        impactDesc: "Costs $150K. Cheapest of the coordinated responses, and stabilizes the story without fully resolving it.",
      },
      {
        label: "D",
        text: "No joint response — each region issues its own independent statement.",
        suggestedTier: "CRITICAL_FAILURE",
        cost: {},
        impactDesc: "No cost — but six different, likely conflicting statements from six regions reads as institutional disarray, and this is what the coordination-failure penalty is scored against.",
      },
    ],
    triggerConditionDesc: "Adaptive, fires 2h after EVT-006 resolves.",
    consequencesJson: {
      optimal: "A with specific corrective commitments — Media Pressure Index drops, sets up better EVT-012.",
      adequate: "C — index stabilizes.",
      inadequate: "B without compelling evidence — media intensifies, NPI compliance drops in 2 regions.",
      critical: "D / no response — coordination failure, media crisis Day 4, conflicting independent statements.",
    },
    modelDeltaDesc: "Option A -> global NPI compliance +8%. Option D/non-response -> global Rt +0.08.",
    modelDeltaJson: {
      OPTIMAL: [{ field: "mediaPressureIndex", region: "GLOBAL", delta: -15 }],
      ADEQUATE: [{ field: "mediaPressureIndex", region: "GLOBAL", delta: -5 }],
      INADEQUATE: [{ field: "mediaPressureIndex", region: "GLOBAL", delta: 10 }],
      CRITICAL_FAILURE: [
        { field: "mediaPressureIndex", region: "GLOBAL", delta: 20 },
        { field: "rt", region: "GLOBAL", delta: 0.08 },
      ],
    },
    noResponseFallbackTier: "CRITICAL_FAILURE",
    requiresMandatoryReview: false,
    requiresCoordination: true,
    isAllocationEvent: false,
    chainPrev: ["EVT-006"],
  },
  {
    id: "EVT-008",
    isCorePath: true,
    suggestedTargetRegions: null,
    title: "AMRO Vaccine Nationalism Disclosure",
    day: 3,
    category: "Vaccine & Therapeutic Distribution / International Aid",
    deadlineType: "SOFT",
    deadlineWindowHours: 4,
    reminderAtHours: 2,
    deadlineWindowDesc: "4h window; non-response triggers formal investigation + AMRO loses Emergency Committee participation for 1 day",
    scope: "MULTI",
    isAnchor: false,
    narrativeMarkdown:
      "A leaked document reveals AMRO's largest member state's separate 200,000-dose bilateral deal signed the same day as the COVAX negotiation. A journalist frames it as \"double-dipping.\" AFRO calls for a WHO investigation. SEARO suspends bilateral cooperation with that member state.",
    decisionPromptMarkdown:
      "AMRO addresses the disclosure — was it disclosed to WHO, does it violate agreements, what corrective action? Other teams state their position/recommended WHO action.",
    minRationaleWords: 150,
    structuredOptionsJson: [
      {
        label: "A",
        text: "Acknowledge the disclosure and commit to routing a meaningful share of the bilateral doses back through COVAX.",
        suggestedTier: "OPTIMAL",
        cost: { fund: 300_000 },
        impactDesc: "Costs $300K in transparency review and coordination with the member state. The only option that actually gives something back rather than just managing the story.",
      },
      {
        label: "B",
        text: "Defend the bilateral deal as sovereign right, while offering full transparency on its terms.",
        suggestedTier: "ADEQUATE",
        cost: { fund: 100_000 },
        impactDesc: "Costs $100K in disclosure preparation. Cheapest credible option — manages the immediate story without committing any doses back.",
      },
      {
        label: "C",
        text: "Dispute the journalist's characterization and request a formal WHO fact-finding review.",
        suggestedTier: "INADEQUATE",
        cost: { fund: 200_000 },
        impactDesc: "Costs $200K to initiate the review. Buys time, but disputing a documented leak rather than addressing it tends to read as evasive.",
      },
      {
        label: "D",
        text: "No public response pending internal legal review.",
        suggestedTier: "CRITICAL_FAILURE",
        cost: {},
        impactDesc: "No cost — but silence on an already-public leaked document reads as confirmation, and AFRO/SEARO are watching this response closely after EVT-006.",
      },
    ],
    triggerConditionDesc: "Adaptive — fires if AMRO's EVT-006 allocation disproportionately retained doses, or automatically 13:00 Day 3.",
    consequencesJson: {
      optimal: "A with meaningful dose contribution — trust partially restored, global CFR improves.",
      adequate: "B/C with transparency commitment — tension managed, no additional doses.",
      inadequate: "B without transparency, or D — AFRO/SEARO formally withdraw bilateral cooperation.",
      critical: "Non-response/misrepresentation — formal WHO investigation, AMRO isolated from coordination for rest of Day 3.",
    },
    modelDeltaDesc: "Option A with sharing -> global CFR -0.06. Option C/D -> coordination efficiency -15% for 24h.",
    modelDeltaJson: {
      OPTIMAL: [{ field: "cfrMultiplier", region: "GLOBAL", delta: -0.06 }],
      ADEQUATE: [],
      INADEQUATE: [{ field: "politicalTensionIndex", region: "SELF", delta: 10 }],
      CRITICAL_FAILURE: [{ field: "politicalTensionIndex", region: "SELF", delta: 20 }],
    },
    noResponseFallbackTier: "CRITICAL_FAILURE",
    requiresMandatoryReview: false,
    requiresCoordination: false,
    isAllocationEvent: false,
    chainPrev: ["EVT-003"],
  },
  {
    id: "EVT-009",
    isCorePath: false,
    suggestedTargetRegions: null,
    title: "Public Trust Crisis / NPI Compliance Collapse",
    day: 3,
    category: "Public Communication & Risk Messaging / NPIs",
    deadlineType: "SOFT",
    deadlineWindowHours: 5,
    reminderAtHours: 2.5,
    deadlineWindowDesc: "5h window; non-response = gathering proceeds unmitigated (super-spreader event fires)",
    scope: "MULTI",
    isAnchor: false,
    narrativeMarkdown:
      "NPI compliance has fallen below 40% in affected region(s). An 80,000-person religious gathering is scheduled in 72h; organizers refuse to cancel. This is a sequential/chain event — prior NPI equity provisions from EVT-004 affect available community trust/options.",
    decisionPromptMarkdown:
      "Submit an emergency communication + enforcement strategy addressing: misinformation response, gathering recommendation, revised NPI package.",
    minRationaleWords: 300,
    structuredOptionsJson: [
      {
        label: "A",
        text: "Recommend cancellation, paired with direct community engagement (organizer meetings, not just a public statement) and a livestream alternative.",
        suggestedTier: "OPTIMAL",
        cost: { fund: 800_000 },
        impactDesc: "Costs $800K to stand up the livestream infrastructure and run the engagement campaign. The most expensive option, but it's the only one that gives organizers and attendees a real alternative instead of just a prohibition.",
      },
      {
        label: "B",
        text: "Recommend modification — capacity limits, move outdoors where possible, mask requirement — rather than outright cancellation.",
        suggestedTier: "ADEQUATE",
        cost: { fund: 300_000, ppeDays: 2 },
        impactDesc: "Costs $300K plus 2 PPE-days (mask distribution at the venue). Cheaper and more politically palatable than cancellation, but a partial mitigation on an 80,000-person indoor gathering still leaves real transmission risk.",
      },
      {
        label: "C",
        text: "Permit the gathering with enhanced entry screening only.",
        suggestedTier: "INADEQUATE",
        cost: { fund: 150_000 },
        impactDesc: "Costs $150K for screening staff at entry points. Entry screening catches symptomatic people on the way in — it does nothing about presymptomatic transmission once everyone's inside for hours.",
      },
      {
        label: "D",
        text: "No recommendation issued; defer entirely to the member state's own judgment.",
        suggestedTier: "INADEQUATE",
        cost: {},
        impactDesc: "No cost — but no guidance either, at the exact moment community trust in guidance is already collapsing.",
      },
    ],
    triggerConditionDesc: "Adaptive — fires only if 2+ regions scored Inadequate/Critical on EVT-004; otherwise a lower-stakes misinformation-only variant fires instead (not separately implemented in this build — see the facilitator guide).",
    consequencesJson: {
      optimal: "A with robust engagement — compliance partially restored, Rt increase contained.",
      adequate: "B — compliance stabilizes, gathering proceeds with partial mitigation.",
      inadequate: "C/D — super-spreader event, regional Rt +0.4 for 48h.",
      critical: "Non-response — super-spreader at max intensity, healthcare surge accelerated, mandatory facilitator escalation.",
    },
    modelDeltaDesc: "Option A -> regional Rt -0.2. Super-spreader (C/D/non-response) -> regional Rt +0.4 for 48h then +0.15 persistent.",
    modelDeltaJson: {
      OPTIMAL: [{ field: "rt", region: "SELF", delta: -0.2 }],
      ADEQUATE: [{ field: "rt", region: "SELF", delta: -0.05 }],
      INADEQUATE: [{ field: "rt", region: "SELF", delta: 0.4 }],
      CRITICAL_FAILURE: [{ field: "rt", region: "SELF", delta: 0.55 }],
    },
    noResponseFallbackTier: "CRITICAL_FAILURE",
    requiresMandatoryReview: true,
    requiresCoordination: false,
    isAllocationEvent: false,
    chainPrev: ["EVT-004"],
  },
  {
    id: "EVT-010",
    isCorePath: true,
    suggestedTargetRegions: null,
    title: "Misinformation Surge (Lab-Origin Conspiracy)",
    day: 3,
    category: "Public Communication & Risk Messaging",
    deadlineType: "SOFT",
    deadlineWindowHours: 4,
    reminderAtHours: 2,
    deadlineWindowDesc: "4h window; non-response -> misinformation continues, Media Pressure Index +20",
    scope: "GLOBAL",
    isAnchor: false,
    narrativeMarkdown:
      "A viral social thread (28M followers) alleges NCoV-X1 is a deliberately-released \"weaponized bioagent,\" citing the EVT-002 sequence redaction as \"proof.\" The correct in-character DG response if asked directly about origin: \"The investigation is ongoing. All hypotheses remain open.\" This is intentional epistemic humility — the app never resolves the origin question.",
    decisionPromptMarkdown:
      "Submit a coordinated misinformation response strategy: public statement on bioweapon claims, engagement with the preprint, recommended government messaging, specific support to SEARO.",
    minRationaleWords: 200,
    structuredOptionsJson: [
      {
        label: "A",
        text: "Stand up a rapid-response communications unit: publish a detailed technical rebuttal citing genomic evidence, and directly contact the preprint's authors and their journal's editors requesting a correction or retraction review.",
        suggestedTier: "OPTIMAL",
        cost: { fund: 700_000 },
        impactDesc: "Costs $700K to stand up the rapid-response unit and the legal/scientific review of the preprint's claims. Historically the fastest way to slow a viral false claim — but directly contacting named authors carries real reputational risk if it isn't handled carefully; it can be read as institutional pressure on independent researchers rather than good-faith engagement.",
      },
      {
        label: "B",
        text: "Issue one coordinated statement acknowledging public concern, noting that all hypotheses remain under investigation, without addressing the specific bioweapon claims directly.",
        suggestedTier: "ADEQUATE",
        cost: { fund: 150_000 },
        impactDesc: "Costs $150K for a single coordinated statement. Far cheaper than a full rapid-response campaign, and carries little risk of becoming its own story — but it's also slower to actually slow the spread of the claim.",
      },
      {
        label: "C",
        text: "Respond only when directly asked by credentialed media outlets; no proactive statement.",
        suggestedTier: "INADEQUATE",
        cost: {},
        impactDesc: "No direct cost, and it avoids amplifying the claim by engaging with it. But a fast-moving viral claim with no public response from WHO in the gap is often read by the public as tacit confirmation — silence has its own cost, it's just not a budget line.",
      },
      {
        label: "D",
        text: "Formally request the UN Security Council convene an emergency session addressing the disinformation campaign as a security threat.",
        suggestedTier: "CRITICAL_FAILURE",
        cost: { fund: 1_200_000 },
        impactDesc: "Costs $1.2M in formal diplomatic process and staff time — the most expensive option by far. Elevating a social-media conspiracy theory to the UN's highest security forum can be read as WHO itself treating the claim as credible enough to require a Security Council response, which tends to legitimize exactly what you're trying to shut down.",
      },
    ],
    triggerConditionDesc: "Adaptive — fires when Media Pressure Index > 65, or automatically 18:00 Day 3.",
    consequencesJson: {
      optimal: "A — spread slowed, Media Pressure Index -15, SEARO cooperation improves.",
      adequate: "B — slows but doesn't stop, index neutral.",
      inadequate: "C — accelerates, index +10, compliance drops in 2 regions.",
      critical: "D or non-response — crisis escalates, index +25, WHO credibility event.",
    },
    modelDeltaDesc: "Option A -> NPI compliance +5% globally. Non-response -> NPI compliance -8% in the two highest-media-pressure regions, Rt +0.06.",
    modelDeltaJson: {
      OPTIMAL: [{ field: "mediaPressureIndex", region: "GLOBAL", delta: -15 }],
      ADEQUATE: [],
      INADEQUATE: [{ field: "mediaPressureIndex", region: "GLOBAL", delta: 10 }],
      CRITICAL_FAILURE: [
        { field: "mediaPressureIndex", region: "GLOBAL", delta: 25 },
        { field: "rt", region: "GLOBAL", delta: 0.06 },
      ],
    },
    noResponseFallbackTier: "CRITICAL_FAILURE",
    requiresMandatoryReview: false,
    requiresCoordination: true,
    isAllocationEvent: false,
    chainPrev: ["EVT-002"],
  },
  {
    id: "EVT-011",
    isCorePath: true,
    suggestedTargetRegions: null,
    title: "AFRO Healthcare Surge / HCW Deployment Request",
    day: 4,
    category: "International Aid & Funding / Healthcare Resource Allocation",
    deadlineType: "HARD",
    deadlineWindowHours: 3,
    reminderAtHours: null,
    deadlineWindowDesc: "3-hour window. Non-response = recorded as Option D (decline).",
    scope: "MULTI",
    isAnchor: false,
    narrativeMarkdown:
      "AFRO healthcare system saturation — bed occupancy >95% in two member states, zero reserve HCW capacity. Joint ministerial emergency declaration requesting international HCW deployment. If AFRO CFR collapse triggers, the narrative language is not softened — this is meant to be the simulation's most emotionally significant moment.",
    decisionPromptMarkdown:
      "All teams except AFRO specify deployment numbers, duration, conditions, own-capacity impact management. AFRO specifies where HCWs are most needed + support infrastructure available.",
    minRationaleWords: 200,
    structuredOptionsJson: [
      {
        label: "A",
        text: "Full deployment — commit 15% of your surplus HCW capacity to AFRO for a 7-day rotation.",
        suggestedTier: "OPTIMAL",
        cost: { fund: 1_500_000 },
        impactDesc: "Costs $1.5M in deployment logistics (travel, housing, coordination with AFRO's health ministries) on top of committing real staff time away from your own hospitals. The most impactful option for AFRO and the most expensive/disruptive for you.",
      },
      {
        label: "B",
        text: "Partial deployment — 7% of surplus HCW capacity, 5-day rotation.",
        suggestedTier: "ADEQUATE",
        cost: { fund: 700_000 },
        impactDesc: "Costs $700K in logistics. Roughly half the commitment and half the relief delivered, but far less strain on your own capacity.",
      },
      {
        label: "C",
        text: "Financial contribution only — fund third-party recruitment rather than deploying your own staff.",
        suggestedTier: "INADEQUATE",
        cost: { fund: 2_000_000 },
        impactDesc: "Costs $2.0M — more expensive than either deployment option, since third-party recruitment carries a premium. Doesn't touch your own HCW capacity at all, but delivers meaningfully less relief per dollar than actually sending trained people.",
      },
      {
        label: "D",
        text: "Decline — the surge risk to your own health system is too high right now.",
        suggestedTier: "INADEQUATE",
        cost: {},
        impactDesc: "No cost to you — and no relief for AFRO's healthcare system, which is already at >95% bed occupancy with zero reserve capacity.",
      },
    ],
    triggerConditionDesc: "Adaptive — fires 08:00 Day 4 if AFRO CFR multiplier > 3.5 or AFRO PPE stock < 10 days.",
    consequencesJson: {
      optimal: "Majority choose A/B — AFRO stabilized, CFR multiplier reduced, donor regions +3% occupancy.",
      adequate: "Mixed response — partial stabilization.",
      inadequate: "Majority decline — AFRO CFR multiplier to max, excess mortality event, AFRO operational capacity reduced Day 5.",
      critical: "All decline — AFRO healthcare collapse event, mortality to simulation maximum, mandatory DG emergency statement.",
    },
    modelDeltaDesc: "Full solidarity -> AFRO CFR multiplier -1.2. Majority decline -> AFRO CFR multiplier +1.5. Donor regions: +3% occupancy per contributing region.",
    modelDeltaJson: {
      OPTIMAL: [
        { field: "cfrMultiplier", region: "AFRO", delta: -1.2 },
        { field: "hospitalCapacityPct", region: "SELF", delta: 3 },
      ],
      ADEQUATE: [
        { field: "cfrMultiplier", region: "AFRO", delta: -0.5 },
        { field: "hospitalCapacityPct", region: "SELF", delta: 3 },
      ],
      INADEQUATE: [{ field: "cfrMultiplier", region: "AFRO", delta: 1.5 }],
      CRITICAL_FAILURE: [{ field: "cfrMultiplier", region: "AFRO", delta: 2.0 }],
    },
    noResponseFallbackTier: "INADEQUATE",
    requiresMandatoryReview: true,
    requiresCoordination: true,
    isAllocationEvent: false,
    chainPrev: ["EVT-005"],
  },
  {
    id: "EVT-012",
    isCorePath: true,
    suggestedTargetRegions: null,
    title: "Second Vaccine Tranche (Revised Allocation)",
    day: 4,
    category: "Vaccine & Therapeutic Distribution",
    deadlineType: "SOFT",
    deadlineWindowHours: 5,
    reminderAtHours: 3,
    deadlineWindowDesc: "5h window; reminder at 3h; non-submitting regions get 0 doses",
    scope: "GLOBAL",
    isAnchor: false,
    narrativeMarkdown:
      "Second COVAX tranche released. Dose pool varies by prior decisions: 280,000 if AMRO contributed bilateral doses (EVT-008 option A); 220,000 standard; 160,000 if EVT-006 was Critical Failure. Teams now have 3 days of visible model consequences from their EVT-006 decision to inform this one.",
    decisionPromptMarkdown:
      "Same allocation-framework structure as EVT-006, but rationale must specifically address: (1) how this corrects/reinforces the EVT-006 decision, (2) what dashboard data is being used to justify the framework, (3) any cross-team coordination undertaken before submitting. This is a first-class debrief artifact — the app compares your EVT-006 and EVT-012 allocations side by side.",
    minRationaleWords: 200,
    structuredOptionsJson: null,
    triggerConditionDesc: "Adaptive — fires 4h after EVT-011 resolves.",
    consequencesJson: {
      optimal: "Improves on EVT-006 equity orientation, demonstrates adaptive management.",
      adequate: "Modest improvement.",
      inadequate: "Repeats EVT-006's pattern despite adverse evidence — no adaptation demonstrated.",
      critical: "Allocation worse than EVT-006 (rare; most important debrief case if it happens).",
    },
    modelDeltaDesc: "Same framework as EVT-006 but with a 1.3x amplification factor.",
    modelDeltaJson: {
      OPTIMAL: [
        { field: "cfrMultiplier", region: "AFRO", delta: -1.04 },
        { field: "cfrMultiplier", region: "SEARO", delta: -0.65 },
      ],
      ADEQUATE: [
        { field: "cfrMultiplier", region: "AFRO", delta: -0.39 },
        { field: "cfrMultiplier", region: "SEARO", delta: -0.26 },
      ],
      INADEQUATE: [{ field: "cfrMultiplier", region: "AFRO", delta: 0.65 }],
      CRITICAL_FAILURE: [{ field: "cfrMultiplier", region: "AFRO", delta: 1.56 }],
    },
    noResponseFallbackTier: "CRITICAL_FAILURE",
    requiresMandatoryReview: false,
    requiresCoordination: true,
    isAllocationEvent: true,
    chainPrev: ["EVT-006", "EVT-008"],
  },
  {
    id: "EVT-013",
    isCorePath: false,
    suggestedTargetRegions: null,
    title: "Political Interference / Member State Demands",
    day: 4,
    category: "Institutional Authority / Public Communication",
    deadlineType: "SOFT",
    deadlineWindowHours: 5,
    reminderAtHours: 2.5,
    deadlineWindowDesc: "5h window; non-response treated as Option D, consequences delayed 24h",
    scope: "REGIONAL",
    isAnchor: false,
    narrativeMarkdown:
      "Region-dependent variant. SEARO: host government demands pre-approval rights over all WHO public communications, threatens to expel WHO country office. EURO: 3 member states demand WHO endorse their travel-ban measures or lose funding. AMRO: largest member state demands WHO publicly refute the bilateral-deal story or lose Emergency Fund contribution.",
    decisionPromptMarkdown:
      "Formal response addressing: accommodate/partially accommodate/reject; legal/normative basis; what (if anything) to communicate publicly.",
    minRationaleWords: 200,
    structuredOptionsJson: [
      {
        label: "A",
        text: "Reject the demand, citing WHO's constitutional independence, and accept whatever consequences the member state follows through on.",
        suggestedTier: "OPTIMAL",
        cost: { fund: 400_000 },
        impactDesc: "Costs $400K in legal defense of WHO's independence and managing the immediate fallout of a funding/access threat. The most expensive option up front, and the one that risks the member state actually following through — but it's also the only one that doesn't set a precedent for the next demand.",
      },
      {
        label: "B",
        text: "Negotiate a modified accommodation that preserves institutional independence in principle while addressing the member state's stated concern.",
        suggestedTier: "ADEQUATE",
        cost: { fund: 200_000 },
        impactDesc: "Costs $200K in negotiation overhead. Cheaper than outright rejection and usually avoids the worst consequences, but requires genuinely careful drafting to not tip into de facto accommodation.",
      },
      {
        label: "C",
        text: "Accommodate the demand to preserve the funding/operational relationship.",
        suggestedTier: "INADEQUATE",
        cost: {},
        impactDesc: "No direct cost — the member state is satisfied, at least for now. But regional public communications become subject to their filter for the rest of the simulation, and the next region facing similar pressure has less room to say no.",
      },
      {
        label: "D",
        text: "Escalate to the DG/Emergency Committee without making a regional decision.",
        suggestedTier: "CRITICAL_FAILURE",
        cost: {},
        impactDesc: "No cost — and no decision. Passing the problem upward without a position of your own reads as either indecision or tacit capitulation, and the demanding member state notices the difference.",
      },
    ],
    triggerConditionDesc: "Adaptive — fires when any region's political tension index > 70.",
    consequencesJson: {
      optimal: "A, principled and well-articulated — short-term cost, WHO credibility preserved globally.",
      adequate: "B — tension managed, no major credibility event.",
      inadequate: "C — WHO independence compromised; regional public communications filtered for rest of simulation.",
      critical: "Non-response/capitulation without negotiation — member state controls WHO messaging in-region, mandatory DG intervention.",
    },
    modelDeltaDesc: "Option A -> short-term political tension only, no direct model impact. Option C -> information quality in affected region -30% for remainder of simulation.",
    modelDeltaJson: {
      OPTIMAL: [{ field: "politicalTensionIndex", region: "SELF", delta: -5 }],
      ADEQUATE: [{ field: "politicalTensionIndex", region: "SELF", delta: -10 }],
      INADEQUATE: [{ field: "surveillanceIndex", region: "SELF", delta: -3 }],
      CRITICAL_FAILURE: [
        { field: "surveillanceIndex", region: "SELF", delta: -3 },
        { field: "publicTrustIndex", region: "SELF", delta: -15 },
      ],
    },
    noResponseFallbackTier: "CRITICAL_FAILURE",
    requiresMandatoryReview: true,
    requiresCoordination: false,
    isAllocationEvent: false,
    chainPrev: ["EVT-007", "EVT-009"],
  },
  {
    id: "EVT-014",
    isCorePath: true,
    suggestedTargetRegions: null,
    title: "Outbreak Trajectory Briefing",
    day: 5,
    category: "Surveillance & Data Sharing",
    deadlineType: "NONE",
    deadlineWindowHours: null,
    reminderAtHours: null,
    deadlineWindowDesc: "No deadline — information event, no decision required",
    scope: "GLOBAL",
    isAnchor: true,
    narrativeMarkdown:
      "Comprehensive 30-day trajectory assessment based on the week's decisions. Each team receives their regional dashboard summary (Rt, CFR, capacity, 30-day projection). Global summary visible to all teams simultaneously. This is the 'week in review' moment where consequences become fully legible.",
    decisionPromptMarkdown: "No decision required — informational only.",
    minRationaleWords: 0,
    structuredOptionsJson: null,
    triggerConditionDesc: "Anchor, fires 08:00 Day 5 automatically.",
    consequencesJson: { optimal: "", adequate: "", inadequate: "", critical: "" },
    modelDeltaDesc: "None — informational event only.",
    modelDeltaJson: { OPTIMAL: [], ADEQUATE: [], INADEQUATE: [], CRITICAL_FAILURE: [] },
    noResponseFallbackTier: "ADEQUATE",
    requiresMandatoryReview: false,
    requiresCoordination: false,
    isAllocationEvent: false,
    chainPrev: ["EVT-010"],
  },
  {
    id: "EVT-015",
    isCorePath: true,
    suggestedTargetRegions: null,
    title: "IHR Reform Proposal (Legacy Decision)",
    day: 5,
    category: "Surveillance & Data Sharing / Institutional Authority",
    deadlineType: "SOFT",
    deadlineWindowHours: 4,
    reminderAtHours: 2,
    deadlineWindowDesc: "4h window; non-submitting teams get Inadequate for the after-action record",
    scope: "GLOBAL",
    isAnchor: false,
    narrativeMarkdown:
      "Joint multi-region proposals carry more narrative weight. This is the after-action anchor — reflect on how this week's decisions connect to institutional reform.",
    decisionPromptMarkdown:
      "(1) identify 2 most significant IHR gaps revealed this week, (2) specify supported amendments and why, (3) address sovereignty interaction, (4) reflect on at least one of the team's own decisions this week that the proposed reform would have prevented or improved.",
    minRationaleWords: 400,
    structuredOptionsJson: [
      {
        label: "A",
        text: "Enforcement package — stronger IHR compliance mechanisms, financial penalties for non-reporting.",
        suggestedTier: "ADEQUATE",
        cost: { fund: 100_000 },
        impactDesc: "Costs $100K in proposal drafting. Addresses non-compliance directly, but penalties alone don't fix the surveillance-capacity gaps that made non-compliance possible in the first place.",
      },
      {
        label: "B",
        text: "Equity package — enshrine health equity in IHR Article 2, mandatory COVAX-equivalent mechanism for future emergencies.",
        suggestedTier: "OPTIMAL",
        cost: { fund: 100_000 },
        impactDesc: "Costs $100K in proposal drafting — same cost as the other packages, so this is a values choice, not a budget one. Most directly ties institutional reform to what actually happened this week.",
      },
      {
        label: "C",
        text: "Transparency package — mandatory real-time data sharing with independent verification.",
        suggestedTier: "ADEQUATE",
        cost: { fund: 100_000 },
        impactDesc: "Costs $100K in proposal drafting. Would have directly changed how EVT-002 played out, but doesn't address the equity gaps from the vaccine allocation events.",
      },
      {
        label: "D",
        text: "Custom — propose your own framework not covered by the above.",
        suggestedTier: "ADEQUATE",
        cost: { fund: 150_000 },
        impactDesc: "Costs $150K — more drafting work than the pre-built packages. Only scores well if it's specific and genuinely tied to your team's own decisions this week, not generic.",
      },
    ],
    triggerConditionDesc: "Adaptive, fires 30 minutes after EVT-014 delivery is confirmed.",
    consequencesJson: {
      optimal: "Thoughtful, evidence-based, connects to the team's own decisions — demonstrates systems thinking.",
      adequate: "Reasonable but somewhat generic.",
      inadequate: "Generic/templated, no connection to specific decisions made.",
      critical: "Non-submission, or a proposal that contradicts the team's own decisions with no self-awareness.",
    },
    modelDeltaDesc: "None — this decision affects the narrative/legacy record only, not the live model.",
    modelDeltaJson: { OPTIMAL: [], ADEQUATE: [], INADEQUATE: [], CRITICAL_FAILURE: [] },
    noResponseFallbackTier: "INADEQUATE",
    requiresMandatoryReview: false,
    requiresCoordination: false,
    isAllocationEvent: false,
    chainPrev: ["EVT-011", "EVT-012", "EVT-014"],
  },
  {
    id: "EVT-016",
    isCorePath: true,
    suggestedTargetRegions: null,
    title: "After-Action Report Initiation (Administrative Close)",
    day: 5,
    category: "Administrative close",
    deadlineType: "NONE",
    deadlineWindowHours: null,
    reminderAtHours: null,
    deadlineWindowDesc: "No deadline",
    scope: "GLOBAL",
    isAnchor: true,
    narrativeMarkdown:
      "The simulation officially concludes. The DG thanks all teams. The after-action report template/instructions are distributed. Simulation model state freezes and is captured for the debrief.",
    decisionPromptMarkdown: "No decision required — administrative close.",
    minRationaleWords: 0,
    structuredOptionsJson: null,
    triggerConditionDesc: "Anchor, fires 14:00 Day 5 regardless of EVT-015 status.",
    consequencesJson: { optimal: "", adequate: "", inadequate: "", critical: "" },
    modelDeltaDesc: "None — administrative close only.",
    modelDeltaJson: { OPTIMAL: [], ADEQUATE: [], INADEQUATE: [], CRITICAL_FAILURE: [] },
    noResponseFallbackTier: "ADEQUATE",
    requiresMandatoryReview: false,
    requiresCoordination: false,
    isAllocationEvent: false,
    chainPrev: ["EVT-015"],
  },
];
