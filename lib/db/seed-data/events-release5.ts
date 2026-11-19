// Release 5 optional events, tied to the new systems (shared R&D, pathogen
// countermeasures, supply shocks, displacement). All optional (never on the
// required path); each fires from a live trigger rule (lib/event-targeting.ts)
// the recommender surfaces when there's room.
//
// DRAFT for facilitator review against simulation-docs/02-decision-matrix.md:
// option tiers follow the matrix's category criteria (cited per event), and
// model deltas are sized like the existing optional events'. Text uses
// "antiviral(s)" and the pathogen name so lib/pathogens.ts can adapt it.
import type { EventSeed } from "./events";

export const release5Events: EventSeed[] = [
  {
    id: "EVT-026",
    isCorePath: false,
    suggestedTargetRegions: null,
    title: "Fast-Tracked Countermeasure: Hesitancy Wave",
    day: 4,
    category: "Public Communication & Risk Messaging",
    deadlineType: "SOFT",
    deadlineWindowHours: 4,
    reminderAtHours: 2,
    deadlineWindowDesc: "4-hour window, soft",
    scope: "GLOBAL",
    isAnchor: false,
    narrativeMarkdown:
      "The shared R&D fund delivered a countermeasure in weeks instead of years. Uptake is now stalling: polls show many people believe trial phases were skipped, and a viral post claims 'nobody knows the long-term effects.' Clinicians in your region report patients declining it.",
    decisionPromptMarkdown:
      "Choose how your region responds to hesitancy about the fast-tracked countermeasure. Justify against evidence, feasibility, and who is most affected by low uptake.",
    minRationaleWords: 150,
    structuredOptionsJson: [
      {
        label: "A",
        text: "Publish the full trial data and an independent safety review; work through trusted community messengers; keep uptake voluntary and make access easy (mobile clinics, paid time off).",
        suggestedTier: "OPTIMAL",
        cost: { fund: 2_000_000 },
        impactDesc: "Costs $2M for outreach and access support. Rebuilds trust over time; uptake rises among high-risk groups first.",
      },
      {
        label: "B",
        text: "Issue an official FAQ and ministerial statement on safety, without new outreach.",
        suggestedTier: "ADEQUATE",
        cost: { fund: 300_000 },
        impactDesc: "Costs $300K. Reaches people who already trust official channels; little change elsewhere.",
      },
      {
        label: "C",
        text: "Require uptake for public-sector workers immediately, without addressing the safety concerns.",
        suggestedTier: "INADEQUATE",
        cost: {},
        impactDesc: "No direct cost. Raises short-term uptake in one group but hardens opposition and politicizes the countermeasure.",
      },
      {
        label: "D",
        text: "Dismiss the concerns publicly as misinformation and take no further action.",
        suggestedTier: "CRITICAL_FAILURE",
        cost: {},
        impactDesc: "No direct cost. Confirms the suspicion that concerns are being ignored; trust falls sharply.",
      },
    ],
    triggerConditionDesc: "Adaptive: available once the shared R&D fund completes its final phase (offered to every region).",
    consequencesJson: {
      optimal: "Transparent data and trusted messengers: trust recovers and uptake rises among high-risk groups.",
      adequate: "Official messaging only: modest effect, mostly among people who already trusted it.",
      inadequate: "Mandate without engagement: uptake up in one group, trust and tension worsen.",
      critical: "Dismissal: trust falls sharply and the hesitancy story spreads.",
    },
    modelDeltaDesc: "Trust and Rt effects on the deciding region; mandate and dismissal raise tension.",
    modelDeltaJson: {
      OPTIMAL: [
        { field: "publicTrustIndex", region: "SELF", delta: 6 },
        { field: "rt", region: "SELF", delta: -0.05 },
      ],
      ADEQUATE: [{ field: "publicTrustIndex", region: "SELF", delta: 2 }],
      INADEQUATE: [
        { field: "publicTrustIndex", region: "SELF", delta: -5 },
        { field: "politicalTensionIndex", region: "SELF", delta: 5 },
      ],
      CRITICAL_FAILURE: [{ field: "publicTrustIndex", region: "SELF", delta: -10 }],
    },
    noResponseFallbackTier: "INADEQUATE",
    requiresMandatoryReview: false,
    requiresCoordination: false,
    isAllocationEvent: false,
    chainPrev: [],
  },
  {
    id: "EVT-027",
    isCorePath: false,
    suggestedTargetRegions: null,
    title: "Countermeasure Resistance Detected",
    day: 3,
    category: "Surveillance & Data Sharing",
    deadlineType: "HARD",
    deadlineWindowHours: 3,
    reminderAtHours: null,
    deadlineWindowDesc: "3-hour window, no extension",
    scope: "REGIONAL",
    isAnchor: false,
    narrativeMarkdown:
      "Reference labs in your region have isolated NCoV-X1 samples that respond poorly to standard antiviral treatment, from patients who received repeated courses. Two hospitals report treatment failures. Sequencing is complete but not yet independently verified.",
    decisionPromptMarkdown:
      "Decide how quickly and how widely to share the resistance findings, and what to change in treatment guidance in the meantime.",
    minRationaleWords: 150,
    structuredOptionsJson: [
      {
        label: "A",
        text: "Share isolate data with WHO and all regions within 24 hours, switch to combination-therapy guidance, and ration remaining antivirals by clinical priority.",
        suggestedTier: "OPTIMAL",
        cost: { antivirals: 500 },
        impactDesc: "Uses 500 antiviral courses for combination therapy. Slows resistance spreading and gives every region time to adjust.",
      },
      {
        label: "B",
        text: "Share within 72 hours after verification; keep the current protocol until then.",
        suggestedTier: "ADEQUATE",
        cost: {},
        impactDesc: "No direct cost. Credible, but resistant strains spread for three more days under the old protocol.",
      },
      {
        label: "C",
        text: "Keep the findings national until verification is complete; no change to guidance.",
        suggestedTier: "INADEQUATE",
        cost: {},
        impactDesc: "No direct cost. Other regions keep using a failing protocol; trust in data sharing erodes when it emerges.",
      },
      {
        label: "D",
        text: "Deny the reports publicly to protect confidence in the stockpile.",
        suggestedTier: "CRITICAL_FAILURE",
        cost: {},
        impactDesc: "No direct cost. Resistance spreads unchecked; when the truth emerges, trust collapses.",
      },
    ],
    triggerConditionDesc: "Adaptive: offered to any region that has used most of its antiviral stockpile (under 2,000 courses left).",
    consequencesJson: {
      optimal: "Rapid sharing and adapted treatment: resistance contained, surveillance strengthened.",
      adequate: "Delayed sharing: some spread before guidance changes.",
      inadequate: "Withheld findings: treatment failures rise in other regions; tension when revealed.",
      critical: "Denial: resistance spreads widely and trust collapses.",
    },
    modelDeltaDesc: "Death-rate multiplier and surveillance on the deciding region; withholding raises tension.",
    modelDeltaJson: {
      OPTIMAL: [
        { field: "surveillanceIndex", region: "SELF", delta: 1 },
        { field: "cfrMultiplier", region: "SELF", delta: -0.05 },
      ],
      ADEQUATE: [{ field: "cfrMultiplier", region: "SELF", delta: 0.05 }],
      INADEQUATE: [
        { field: "cfrMultiplier", region: "SELF", delta: 0.15 },
        { field: "politicalTensionIndex", region: "SELF", delta: 5 },
      ],
      CRITICAL_FAILURE: [
        { field: "cfrMultiplier", region: "SELF", delta: 0.3 },
        { field: "publicTrustIndex", region: "SELF", delta: -8 },
      ],
    },
    noResponseFallbackTier: "INADEQUATE",
    requiresMandatoryReview: false,
    requiresCoordination: false,
    isAllocationEvent: false,
    chainPrev: [],
  },
  {
    id: "EVT-028",
    isCorePath: false,
    suggestedTargetRegions: null,
    title: "Supply Chain Shock: PPE Factory Fire",
    day: 2,
    category: "International Aid & Funding",
    deadlineType: "SOFT",
    deadlineWindowHours: 4,
    reminderAtHours: 2,
    deadlineWindowDesc: "4-hour window, soft",
    scope: "GLOBAL",
    isAnchor: false,
    narrativeMarkdown:
      "A fire has destroyed one of the world's largest PPE factories. Global supply of respirators and gowns drops sharply for at least a month, and prices on open markets triple overnight. Regions with thin stockpiles are most exposed.",
    decisionPromptMarkdown:
      "Decide how your region secures PPE while supply is short, and whether you act alone or through a shared mechanism.",
    minRationaleWords: 150,
    structuredOptionsJson: [
      {
        label: "A",
        text: "Join WHO-coordinated pooled procurement with need-based distribution, and commit part of your purchase to the hardest-hit regions.",
        suggestedTier: "OPTIMAL",
        cost: { fund: 3_000_000 },
        impactDesc: "Costs $3M. Secures supply at pooled prices and reaches high-need regions first.",
      },
      {
        label: "B",
        text: "Buy from alternative suppliers at premium prices for your own needs only.",
        suggestedTier: "ADEQUATE",
        cost: { fund: 4_000_000 },
        impactDesc: "Costs $4M. Covers your needs, at a higher price, and doesn't help other regions.",
      },
      {
        label: "C",
        text: "Restrict exports of PPE made in your region until your own stockpile recovers.",
        suggestedTier: "INADEQUATE",
        cost: {},
        impactDesc: "No direct cost. Protects your stock, but other regions lose supply and tension rises.",
      },
      {
        label: "D",
        text: "Take no action and wait for the market to recover.",
        suggestedTier: "CRITICAL_FAILURE",
        cost: {},
        impactDesc: "No direct cost. Health workers go without protection; infections among staff rise.",
      },
    ],
    triggerConditionDesc: "Adaptive: offered to any region whose PPE stock has fallen below 15 days.",
    consequencesJson: {
      optimal: "Pooled procurement: supply restored where needed most; solidarity noted.",
      adequate: "Premium purchase: own needs met at high cost.",
      inadequate: "Export restriction: own stock protected; neighbors short; tension rises.",
      critical: "No action: health-worker infections and hospital strain rise.",
    },
    modelDeltaDesc: "PPE days, trust and tension on the deciding region; inaction raises hospital occupancy.",
    modelDeltaJson: {
      OPTIMAL: [
        { field: "ppeDaysRemaining", region: "SELF", delta: 10 },
        { field: "publicTrustIndex", region: "SELF", delta: 2 },
      ],
      ADEQUATE: [{ field: "ppeDaysRemaining", region: "SELF", delta: 8 }],
      INADEQUATE: [
        { field: "ppeDaysRemaining", region: "SELF", delta: 6 },
        { field: "politicalTensionIndex", region: "SELF", delta: 8 },
      ],
      CRITICAL_FAILURE: [
        { field: "hospitalCapacityPct", region: "SELF", delta: 5 },
        { field: "hcwSurgePct", region: "SELF", delta: -2 },
      ],
    },
    noResponseFallbackTier: "CRITICAL_FAILURE",
    requiresMandatoryReview: false,
    requiresCoordination: false,
    isAllocationEvent: false,
    chainPrev: [],
  },
  {
    id: "EVT-029",
    isCorePath: false,
    suggestedTargetRegions: null,
    title: "Cross-Border Displacement",
    day: 3,
    category: "Travel & Border Restrictions",
    deadlineType: "HARD",
    deadlineWindowHours: 3,
    reminderAtHours: null,
    deadlineWindowDesc: "3-hour window, no extension",
    scope: "REGIONAL",
    isAnchor: false,
    narrativeMarkdown:
      "Fear of the outbreak and local lockdowns have pushed tens of thousands of people toward your region's borders, many of them migrant workers trying to get home. Border towns report overcrowded crossings and no testing or isolation capacity.",
    decisionPromptMarkdown: "Decide how your region manages the crossings. Weigh transmission risk, feasibility, and the people moving.",
    minRationaleWords: 150,
    structuredOptionsJson: [
      {
        label: "A",
        text: "Open humanitarian corridors with testing, short isolation support (food, shelter, wages), and coordination with neighboring regions.",
        suggestedTier: "OPTIMAL",
        cost: { fund: 3_000_000 },
        impactDesc: "Costs $3M. Moves people safely while catching cases; follows the matrix's risk-stratified, humanitarian-exemption standard.",
      },
      {
        label: "B",
        text: "Screen at the main crossings only, without isolation support.",
        suggestedTier: "ADEQUATE",
        cost: { fund: 800_000 },
        impactDesc: "Costs $800K. Catches some cases; people avoid screening where they can.",
      },
      {
        label: "C",
        text: "Close the borders entirely until further notice.",
        suggestedTier: "INADEQUATE",
        cost: {},
        impactDesc: "No direct cost. Pushes people to irregular crossings with no screening at all; neighbors object.",
      },
      {
        label: "D",
        text: "Force people back toward their points of departure.",
        suggestedTier: "CRITICAL_FAILURE",
        cost: {},
        impactDesc: "No direct cost. Forced mass movement accelerates spread and causes a humanitarian crisis.",
      },
    ],
    triggerConditionDesc: "Adaptive: offered to any region whose Rt has reached 1.8 or more.",
    consequencesJson: {
      optimal: "Corridors with testing and support: movement continues safely; trust rises.",
      adequate: "Screening only: partial case-finding.",
      inadequate: "Closure: irregular crossings; tension with neighbors.",
      critical: "Forced returns: spread accelerates; severe trust and tension damage.",
    },
    modelDeltaDesc: "Rt, trust and tension on the deciding region.",
    modelDeltaJson: {
      OPTIMAL: [
        { field: "rt", region: "SELF", delta: -0.05 },
        { field: "publicTrustIndex", region: "SELF", delta: 3 },
      ],
      ADEQUATE: [{ field: "rt", region: "SELF", delta: -0.02 }],
      INADEQUATE: [
        { field: "rt", region: "SELF", delta: 0.05 },
        { field: "politicalTensionIndex", region: "SELF", delta: 8 },
        { field: "publicTrustIndex", region: "SELF", delta: -3 },
      ],
      CRITICAL_FAILURE: [
        { field: "rt", region: "SELF", delta: 0.15 },
        { field: "publicTrustIndex", region: "SELF", delta: -10 },
        { field: "politicalTensionIndex", region: "SELF", delta: 12 },
      ],
    },
    noResponseFallbackTier: "INADEQUATE",
    requiresMandatoryReview: false,
    requiresCoordination: false,
    isAllocationEvent: false,
    chainPrev: [],
  },
];
