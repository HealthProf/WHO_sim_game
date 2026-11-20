// Mid-event disruptors (Release 5): realistic developments that land partway
// through an event and change the choices a team has. Each is drawn once,
// per team, when the event is released (lib/disruptors.ts): whether it
// happens (probability) and when (a random point between 15% and 50% of the
// team's decision window). Static content, like the events themselves.
//
// Two kinds:
// - "remove": the named options are no longer available (the reason is
//   shown). A team that already submitted one of them keeps its choice;
//   only later submissions are affected.
// - "warn": the options stay available but now carry a stated cost, which
//   is applied if the team's final choice is one of them, on top of the
//   event's normal outcome. "whoFundPct" shrinks WHO HQ's own budget, which
//   every region relies on for purchases and emergency funding, and every
//   team is told why.
//
// DRAFT for facilitator review: these are plausible, not historical, and
// the probabilities and sizes are first guesses to tune after playtesting.
import type { ModelDelta } from "./events";

export interface DisruptorSeed {
  id: string;
  eventId: string;
  // Only these regions can draw it; omit for any region.
  regions?: string[];
  probability: number;
  headline: string;
  text: string;
  kind: "remove" | "warn";
  options: string[];
  // For "warn": what choosing an affected option will cost.
  warning?: string;
  consequence?: { whoFundPct?: number; deltas?: ModelDelta[] };
}

export const disruptorSeed: DisruptorSeed[] = [
  {
    id: "DIS-001",
    eventId: "EVT-001",
    probability: 0.2,
    headline: "Funding threat over a declaration",
    text: "A major donor state publicly warns it will cut its voluntary WHO contribution if a PHEIC is declared this week, calling it 'premature and economically reckless.'",
    kind: "warn",
    options: ["A", "B"],
    warning: "Supporting a declaration now may cost WHO 5% of its emergency fund.",
    consequence: { whoFundPct: 5 },
  },
  {
    id: "DIS-002",
    eventId: "EVT-002",
    regions: ["SEARO"],
    probability: 0.3,
    headline: "Partial sequence leaks online",
    text: "A partial genome assembly, apparently from a hospital lab in your region, has been posted to a public preprint server. Withholding the full sequence now looks like a cover-up.",
    kind: "warn",
    options: ["C"],
    warning: "Declining to release now will likely cost public trust (about 6 points) and raise tension with neighbors.",
    consequence: {
      deltas: [
        { field: "publicTrustIndex", region: "SELF", delta: -6 },
        { field: "politicalTensionIndex", region: "SELF", delta: 5 },
      ],
    },
  },
  {
    id: "DIS-003",
    eventId: "EVT-003",
    regions: ["EURO"],
    probability: 0.25,
    headline: "Court suspends one of the travel bans",
    text: "A national constitutional court has suspended one member state's blanket travel ban pending review, citing the absence of an epidemiological justification.",
    kind: "remove",
    options: ["C"],
  },
  {
    id: "DIS-004",
    eventId: "EVT-004",
    probability: 0.25,
    headline: "Head of state rejects mask mandates",
    text: "The leader of your region's largest member state gives a televised speech rejecting mask mandates as 'government overreach' and threatens to pull funding from WHO if the regional office endorses them.",
    kind: "warn",
    options: ["LAYERED", "MODERATE"],
    warning: "Recommending a mask mandate may cost WHO 8% of its emergency fund and raise political tension.",
    consequence: { whoFundPct: 8, deltas: [{ field: "politicalTensionIndex", region: "SELF", delta: 6 }] },
  },
  {
    id: "DIS-005",
    eventId: "EVT-005",
    probability: 0.2,
    headline: "PPE shipment impounded",
    text: "A PPE consignment you had staged for SEARO has been impounded at a transit port over customs paperwork. A full contribution now has to come from reserve stock with expedited freight.",
    kind: "warn",
    options: ["A"],
    warning: "A full contribution now costs about 5 extra PPE days (replacement stock and freight).",
    consequence: { deltas: [{ field: "ppeDaysRemaining", region: "SELF", delta: -5 }] },
  },
  {
    id: "DIS-006",
    eventId: "EVT-008",
    regions: ["AMRO"],
    probability: 0.35,
    headline: "Largest member state threatens WHO funding",
    text: "Your region's largest member state says it will withdraw its pledge to WHO's emergency fund if any of its bilateral doses are routed through COVAX.",
    kind: "warn",
    options: ["A"],
    warning: "Routing doses back through COVAX may cost WHO 10% of its emergency fund, leaving less for every region's purchases and emergency requests.",
    consequence: { whoFundPct: 10 },
  },
  {
    id: "DIS-007",
    eventId: "EVT-009",
    probability: 0.25,
    headline: "Organizers move the gathering forward",
    text: "The organizers have moved the gathering forward by a day. There is no longer time to arrange capacity limits or an outdoor venue.",
    kind: "remove",
    options: ["B"],
  },
  {
    id: "DIS-008",
    eventId: "EVT-011",
    probability: 0.3,
    headline: "Nursing union strikes over overseas deployment",
    text: "Your largest nursing union has called a strike over deploying staff abroad while home hospitals are stretched. A full deployment is no longer possible this week.",
    kind: "remove",
    options: ["A"],
  },
];
