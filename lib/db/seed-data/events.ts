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
    | "mediaPressureIndex";
  region: "SELF" | "GLOBAL" | "AFRO" | "AMRO" | "EMRO" | "EURO" | "SEARO" | "WPRO";
  delta: number;
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
  structuredOptionsJson: { label: string; text: string; suggestedTier: Tier }[] | null;
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
      { label: "A", text: "Declare PHEIC immediately, standard language — economics irrelevant to Article 12.", suggestedTier: "OPTIMAL" },
      { label: "B", text: "Declare but with modified language acknowledging economic impact.", suggestedTier: "ADEQUATE" },
      { label: "C", text: "Delay 48h for more data.", suggestedTier: "INADEQUATE" },
      { label: "D", text: "Abstain pending member state consultation.", suggestedTier: "INADEQUATE" },
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
      { label: "A", text: "Release full sequence immediately.", suggestedTier: "OPTIMAL" },
      { label: "B", text: "Controlled release to WHO reference labs only (confidential).", suggestedTier: "ADEQUATE" },
      { label: "C", text: "Refuse pending national review (~72h).", suggestedTier: "INADEQUATE" },
      { label: "D", text: "Request WHO mediation first.", suggestedTier: "INADEQUATE" },
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
      { label: "A", text: "Full Article 43 notification with justification, maintain bans.", suggestedTier: "ADEQUATE" },
      { label: "B", text: "Modify to risk-based screening per WHO guidance.", suggestedTier: "OPTIMAL" },
      { label: "C", text: "Maintain bans, decline WHO notification (cites sovereignty).", suggestedTier: "INADEQUATE" },
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
      { label: "LAYERED", text: "Layered bundle (4+ measures) + equity provisions.", suggestedTier: "OPTIMAL" },
      { label: "MODERATE", text: "Moderate bundle (2-3 measures) + some equity provisions.", suggestedTier: "ADEQUATE" },
      { label: "MINIMAL", text: "1-2 measures, delayed, no equity provisions.", suggestedTier: "INADEQUATE" },
      { label: "NONE", text: "No measures / counterproductive measures.", suggestedTier: "CRITICAL_FAILURE" },
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
      { label: "A", text: "Full solidarity — contribute 20% of regional PPE stock, no conditions.", suggestedTier: "OPTIMAL" },
      { label: "B", text: "Conditional — 10% with accountability reporting.", suggestedTier: "ADEQUATE" },
      { label: "C", text: "Decline contribution, offer technical/logistics support instead.", suggestedTier: "INADEQUATE" },
      { label: "D", text: "No response.", suggestedTier: "CRITICAL_FAILURE" },
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
      { label: "A", text: "Joint acknowledgment — accept equity shortfall, commit to revised framework for next tranche.", suggestedTier: "OPTIMAL" },
      { label: "B", text: "Joint rebuttal — defend allocation, reject characterization.", suggestedTier: "INADEQUATE" },
      { label: "C", text: "Partial acknowledgment.", suggestedTier: "ADEQUATE" },
      { label: "D", text: "No joint response (independent).", suggestedTier: "CRITICAL_FAILURE" },
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
      { label: "A", text: "Acknowledge, commit to sharing a portion via COVAX.", suggestedTier: "OPTIMAL" },
      { label: "B", text: "Defend as sovereign right, offer transparency.", suggestedTier: "ADEQUATE" },
      { label: "C", text: "Dispute characterization, request WHO fact-finding.", suggestedTier: "INADEQUATE" },
      { label: "D", text: "No response pending legal review.", suggestedTier: "CRITICAL_FAILURE" },
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
      { label: "A", text: "Recommend cancellation + community engagement + livestream alternative.", suggestedTier: "OPTIMAL" },
      { label: "B", text: "Recommend modification (capacity limit, outdoor, mask requirement).", suggestedTier: "ADEQUATE" },
      { label: "C", text: "Permit with enhanced entry screening.", suggestedTier: "INADEQUATE" },
      { label: "D", text: "No recommendation, defer to member state.", suggestedTier: "INADEQUATE" },
    ],
    triggerConditionDesc: "Adaptive — fires only if 2+ regions scored Inadequate/Critical on EVT-004; otherwise EVT-009-ALT (lower-stakes variant) fires instead.",
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
      { label: "A", text: "Proactive — strong rebuttal with specific evidence, direct engagement with preprint authors/journal editors.", suggestedTier: "OPTIMAL" },
      { label: "B", text: "Measured — acknowledge concern, note investigation ongoing, don't directly address allegations.", suggestedTier: "ADEQUATE" },
      { label: "C", text: "Reactive — respond only to direct media inquiries.", suggestedTier: "INADEQUATE" },
      { label: "D", text: "Escalate — request UN Security Council discussion (over-escalation).", suggestedTier: "CRITICAL_FAILURE" },
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
      { label: "A", text: "Full deployment — 15% of surplus HCW capacity, 7-day rotation.", suggestedTier: "OPTIMAL" },
      { label: "B", text: "Partial — 7%, 5-day rotation.", suggestedTier: "ADEQUATE" },
      { label: "C", text: "Financial contribution only (fund third-party recruitment).", suggestedTier: "INADEQUATE" },
      { label: "D", text: "Decline — surge risk too high.", suggestedTier: "INADEQUATE" },
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
      { label: "A", text: "Reject, citing WHO's constitutional independence; accept threatened consequences.", suggestedTier: "OPTIMAL" },
      { label: "B", text: "Negotiate modified accommodation preserving independence in principle.", suggestedTier: "ADEQUATE" },
      { label: "C", text: "Accommodate to preserve relationship/funding.", suggestedTier: "INADEQUATE" },
      { label: "D", text: "Escalate to DG/Emergency Committee without a regional decision.", suggestedTier: "CRITICAL_FAILURE" },
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
      { label: "A", text: "Enforcement package — stronger IHR compliance mechanisms, financial penalties for non-reporting.", suggestedTier: "ADEQUATE" },
      { label: "B", text: "Equity package — enshrine health equity in IHR Article 2, mandatory COVAX-equivalent mechanism.", suggestedTier: "OPTIMAL" },
      { label: "C", text: "Transparency package — mandatory real-time data sharing with independent verification.", suggestedTier: "ADEQUATE" },
      { label: "D", text: "Custom — team-proposed framework.", suggestedTier: "ADEQUATE" },
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
