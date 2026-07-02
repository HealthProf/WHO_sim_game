import {
  pgTable,
  text,
  integer,
  real,
  boolean,
  timestamp,
  serial,
  jsonb,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["student", "instructor"]);
export const deadlineTypeEnum = pgEnum("deadline_type", ["HARD", "SOFT", "NONE"]);
export const eventScopeEnum = pgEnum("event_scope", ["GLOBAL", "REGIONAL", "MULTI"]);
export const dispatchStatusEnum = pgEnum("dispatch_status", [
  "queued",
  "dispatched",
  "responded",
  "scored",
  "closed",
]);
export const tierEnum = pgEnum("tier", [
  "OPTIMAL",
  "ADEQUATE",
  "INADEQUATE",
  "CRITICAL_FAILURE",
]);
export const escalationStateEnum = pgEnum("escalation_state", ["GREEN", "AMBER", "RED"]);
export const simStatusEnum = pgEnum("sim_status", [
  "not_started",
  "running",
  "paused",
  "completed",
]);
export const confidenceLevelEnum = pgEnum("confidence_level", ["LOW", "MEDIUM", "HIGH"]);
export const resourceTypeEnum = pgEnum("resource_type", [
  "FUND",
  "PPE_DAYS",
  "ANTIVIRALS",
  "HCW_SURGE_PCT",
]);
export const snapVoteStatusEnum = pgEnum("snap_vote_status", ["open", "closed"]);
export const announcementScopeEnum = pgEnum("announcement_scope", ["global_display", "team"]);
export const budgetCycleModeEnum = pgEnum("budget_cycle_mode", ["default", "custom", "snap_vote"]);
export const budgetCycleStatusEnum = pgEnum("budget_cycle_status", [
  "pending_instructor",
  "collecting_responses",
  "collecting_donations",
  "closed",
]);
export const budgetChoiceEnum = pgEnum("budget_choice", ["accept", "request_more"]);
export const marketRequestStatusEnum = pgEnum("market_request_status", ["pending", "approved", "rejected"]);
export const tradeOfferStatusEnum = pgEnum("trade_offer_status", ["pending", "accepted", "rejected"]);
export const emergencyRequestStatusEnum = pgEnum("emergency_request_status", ["open", "closed"]);
export const marketResourceEnum = pgEnum("market_resource", ["PPE_DAYS", "ANTIVIRALS"]);

// Static reference data — seeded once from 04-regions.md
export const regions = pgTable("regions", {
  id: text("id").primaryKey(), // AFRO | AMRO | EMRO | EURO | SEARO | WPRO
  fullName: text("full_name").notNull(),
  roleTitle: text("role_title").notNull(),
  hqLocation: text("hq_location").notNull(),
  memberStatesDesc: text("member_states_desc").notNull(),
  populationDesc: text("population_desc").notNull(),
  startingFund: integer("starting_fund").notNull(),
  startingPpeDays: integer("starting_ppe_days").notNull(),
  startingAntivirals: integer("starting_antivirals").notNull(),
  startingHcwSurgePct: integer("starting_hcw_surge_pct").notNull(),
  startingSurveillanceIndex: integer("starting_surveillance_index").notNull(),
  startingCfrMultiplier: real("starting_cfr_multiplier").notNull(),
  populationWeight: real("population_weight").notNull(),
  startingPoliticalTension: integer("starting_political_tension").notNull(),
  startingPublicTrust: integer("starting_public_trust").notNull(),
  startingConfirmed: integer("starting_confirmed").notNull(),
  startingDeaths: integer("starting_deaths").notNull(),
  startingEstTrueLow: integer("starting_est_true_low").notNull(),
  startingEstTrueHigh: integer("starting_est_true_high").notNull(),
  startingHospCapacityPct: integer("starting_hosp_capacity_pct").notNull(),
  startingRt: real("starting_rt").notNull(),
  profileMarkdown: text("profile_markdown").notNull(),
});

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  regionId: text("region_id")
    .notNull()
    .unique()
    .references(() => regions.id),
  username: text("username").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull(),
  teamId: integer("team_id").references(() => teams.id),
});

// Singleton row (id = 1)
export const globalState = pgTable("global_state", {
  id: integer("id").primaryKey().default(1),
  currentDay: integer("current_day").notNull().default(1),
  escalationState: escalationStateEnum("escalation_state").notNull().default("GREEN"),
  mediaPressureIndex: integer("media_pressure_index").notNull().default(0),
  simulationStatus: simStatusEnum("simulation_status").notNull().default("not_started"),
  fastModeMultiplier: real("fast_mode_multiplier").notNull().default(1 / 60), // real minutes per stated event-deadline hour — deadline windows only, unrelated to the narrative-day clock below
  respectBlackoutWindow: boolean("respect_blackout_window").notNull().default(false),
  // Simulation clock — see lib/sim-clock.ts. simulationStartedAt is set the
  // first time the simulation is started; pausedAccumulatedMs is the running
  // total of time spent paused (excluded from elapsed-time math so the clock
  // freezes correctly across a pause); pausedAt marks the moment the most
  // recent pause/completion began (null while running).
  simulationStartedAt: timestamp("simulation_started_at"),
  pausedAccumulatedMs: integer("paused_accumulated_ms").notNull().default(0),
  pausedAt: timestamp("paused_at"),
  // Narrative-day progress clock: the story spans totalGameDays (default 90,
  // i.e. ~3 months) and advances at gameDaysPerRealMinute (default 1.5, so
  // 90 days / 60 real minutes) — deliberately independent of
  // fastModeMultiplier, which only governs individual event deadline
  // windows. At this compression, hour-of-day granularity isn't meaningful
  // (each real second is ~36 in-game minutes), so the displayed clock is
  // day-level only.
  gameDaysPerRealMinute: real("game_days_per_real_minute").notNull().default(1.5),
  totalGameDays: integer("total_game_days").notNull().default(90),
  // Passive drift (see lib/model-engine.ts applyPassiveDrift): a small
  // continuous Rt creep applied while the sim is running and no fresh
  // containment decision has landed, so idle real time between dispatched
  // events still carries a cost. lastDriftAppliedAt tracks the last time it
  // was applied so repeated polls don't double-apply it.
  lastDriftAppliedAt: timestamp("last_drift_applied_at"),
  // WHO HQ's own budget/stockpile (see lib/economy.ts) — deliberately larger
  // than any single region's starting fund and, unlike regions, never
  // resupplied by the periodic budget cycle. Depletes as it sells PPE/
  // antivirals to regions (item 3) and as the instructor contributes to
  // emergency funding requests (item 5).
  whoHqFund: integer("who_hq_fund").notNull().default(500_000_000),
  whoHqPpeStock: integer("who_hq_ppe_stock").notNull().default(2000),
  whoHqAntiviralsStock: integer("who_hq_antivirals_stock").notNull().default(200_000),
  // Narrative-day (see lib/sim-clock.ts) of the last budget cycle disbursement
  // — the next one is due 14 narrative days later. 0 means none has run yet.
  lastBudgetCycleNarrativeDay: real("last_budget_cycle_narrative_day").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Current live state per region
export const modelState = pgTable("model_state", {
  id: serial("id").primaryKey(),
  regionId: text("region_id")
    .notNull()
    .unique()
    .references(() => regions.id),
  day: integer("day").notNull().default(1),
  rt: real("rt").notNull(),
  cfrMultiplier: real("cfr_multiplier").notNull(),
  confirmedCases: integer("confirmed_cases").notNull(),
  estimatedTrueCasesLow: integer("estimated_true_cases_low").notNull(),
  estimatedTrueCasesHigh: integer("estimated_true_cases_high").notNull(),
  deaths: integer("deaths").notNull(),
  hospitalCapacityPct: integer("hospital_capacity_pct").notNull(),
  surveillanceIndex: integer("surveillance_index").notNull(),
  fundRemaining: integer("fund_remaining").notNull(),
  ppeDaysRemaining: integer("ppe_days_remaining").notNull(),
  antiviralsRemaining: integer("antivirals_remaining").notNull(),
  hcwSurgePct: integer("hcw_surge_pct").notNull(),
  politicalTensionIndex: integer("political_tension_index").notNull(),
  publicTrustIndex: integer("public_trust_index").notNull(),
  // "Population happiness" — a distinct social metric from trust (item 8):
  // trust tracks whether the public believes official communications;
  // happiness tracks general public sentiment/morale, driven by NPI
  // severity, death growth, escalation state, and event outcomes. See
  // lib/model-engine.ts for how each is updated.
  populationHappinessIndex: integer("population_happiness_index").notNull().default(60),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// A parallel "what if every decision had been Optimal" shadow simulation,
// updated in lockstep with model_state (see lib/model-engine.ts) — every
// scored decision applies its OPTIMAL-tier delta here regardless of what
// tier actually happened, and the same epidemic-progression/drift formula
// runs against this table's own Rt/CFR. This is what powers the debrief's
// "actual vs. achievable" comparison (item 7) without needing to replay the
// whole game's history after the fact.
export const modelStateOptimal = pgTable("model_state_optimal", {
  id: serial("id").primaryKey(),
  regionId: text("region_id")
    .notNull()
    .unique()
    .references(() => regions.id),
  rt: real("rt").notNull(),
  cfrMultiplier: real("cfr_multiplier").notNull(),
  confirmedCases: integer("confirmed_cases").notNull(),
  estimatedTrueCasesLow: integer("estimated_true_cases_low").notNull(),
  estimatedTrueCasesHigh: integer("estimated_true_cases_high").notNull(),
  deaths: integer("deaths").notNull(),
  publicTrustIndex: integer("public_trust_index").notNull(),
  populationHappinessIndex: integer("population_happiness_index").notNull().default(60),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Append-only log — critical for after-action reports
export const modelStateHistory = pgTable("model_state_history", {
  id: serial("id").primaryKey(),
  regionId: text("region_id")
    .notNull()
    .references(() => regions.id),
  day: integer("day").notNull(),
  snapshotJson: jsonb("snapshot_json").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Static reference data — seeded once from 03-events.md
export const events = pgTable("events", {
  id: text("id").primaryKey(), // "EVT-001"
  title: text("title").notNull(),
  day: integer("day").notNull(),
  category: text("category").notNull(),
  deadlineType: deadlineTypeEnum("deadline_type").notNull(),
  deadlineWindowHours: real("deadline_window_hours"), // stated window in the source doc; null = NONE
  reminderAtHours: real("reminder_at_hours"), // for SOFT deadlines
  deadlineWindowDesc: text("deadline_window_desc").notNull(),
  scope: eventScopeEnum("scope").notNull(),
  isAnchor: boolean("is_anchor").notNull().default(false),
  narrativeMarkdown: text("narrative_markdown").notNull(),
  decisionPromptMarkdown: text("decision_prompt_markdown").notNull(),
  minRationaleWords: integer("min_rationale_words").notNull().default(0),
  structuredOptionsJson: jsonb("structured_options_json"), // [{label, text, suggestedTier}]
  triggerConditionDesc: text("trigger_condition_desc").notNull(),
  consequencesJson: jsonb("consequences_json").notNull(), // {optimal, adequate, inadequate, critical}
  modelDeltaDesc: text("model_delta_desc").notNull(),
  modelDeltaJson: jsonb("model_delta_json"), // structured per-tier deltas, see lib/model-engine.ts
  noResponseFallbackTier: tierEnum("no_response_fallback_tier").notNull(),
  requiresMandatoryReview: boolean("requires_mandatory_review").notNull().default(false),
  requiresCoordination: boolean("requires_coordination").notNull().default(false),
  isAllocationEvent: boolean("is_allocation_event").notNull().default(false), // EVT-006/EVT-012 style
  // Marks the recommended lean spine of events for a ~60-minute live session
  // (see lib/db/seed-data/events.ts for which events are flagged and why).
  // Purely advisory — dispatch is never blocked by this, it's a facilitator
  // hint on the Control page for deciding what to cut if time is short.
  isCorePath: boolean("is_core_path").notNull().default(true),
  // Pre-fills the Control page's region picker on dispatch — null means
  // "suggest all six" (the common case). A non-null array means the event's
  // source design (03-events.md) names a specific subset (e.g. EVT-002:
  // SEARO/WPRO/EURO). Always editable by the instructor before dispatch —
  // this is a suggestion, not an enforced restriction.
  suggestedTargetRegions: jsonb("suggested_target_regions"), // string[] | null
});

export const eventChainLinks = pgTable("event_chain_links", {
  id: serial("id").primaryKey(),
  prevEventId: text("prev_event_id")
    .notNull()
    .references(() => events.id),
  nextEventId: text("next_event_id")
    .notNull()
    .references(() => events.id),
});

// One row per time an event fires for a given target (or per team for global events)
export const eventDispatches = pgTable("event_dispatches", {
  id: serial("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id),
  targetTeamId: integer("target_team_id").references(() => teams.id), // null = broadcast/global row
  dispatchedAt: timestamp("dispatched_at").defaultNow().notNull(),
  deadlineAt: timestamp("deadline_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  status: dispatchStatusEnum("status").notNull().default("dispatched"),
  revealedToPublic: boolean("revealed_to_public").notNull().default(false),
  dispatchedByUserId: integer("dispatched_by_user_id").references(() => users.id),
});

export const decisions = pgTable("decisions", {
  id: serial("id").primaryKey(),
  eventDispatchId: integer("event_dispatch_id")
    .notNull()
    .references(() => eventDispatches.id),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id),
  submittedByUserId: integer("submitted_by_user_id")
    .notNull()
    .references(() => users.id),
  structuredChoice: text("structured_choice"),
  rationaleText: text("rationale_text").notNull(),
  resourceAllocationJson: jsonb("resource_allocation_json"),
  coordinatedWithTeamsJson: jsonb("coordinated_with_teams_json"),
  // Self-reported confidence in this decision ("calibration wager" — see
  // lib/scoring.ts computeCalibrationAdjustment). Null for system-generated
  // no-response fallback decisions, which carry no calibration signal.
  confidenceLevel: confidenceLevelEnum("confidence_level"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});

export const scores = pgTable("scores", {
  id: serial("id").primaryKey(),
  decisionId: integer("decision_id")
    .notNull()
    .unique()
    .references(() => decisions.id),
  evidenceScore: integer("evidence_score").notNull(),
  politicalScore: integer("political_score").notNull(),
  equityScore: integer("equity_score").notNull(),
  // Composite before the calibration-wager adjustment (see lib/scoring.ts) —
  // kept for transparency/debrief even though `tier` is derived from the
  // final, adjusted compositePct below.
  rawCompositePct: real("raw_composite_pct").notNull(),
  calibrationAdjustment: real("calibration_adjustment").notNull().default(0),
  compositePct: real("composite_pct").notNull(),
  tier: tierEnum("tier").notNull(),
  suggestedTier: tierEnum("suggested_tier"),
  tierOverridden: boolean("tier_overridden").notNull().default(false),
  overrideReason: text("override_reason"),
  fastPathed: boolean("fast_pathed").notNull().default(false),
  scoredByUserId: integer("scored_by_user_id")
    .notNull()
    .references(() => users.id),
  scoredAt: timestamp("scored_at").defaultNow().notNull(),
});

export const coordinationMessages = pgTable("coordination_messages", {
  id: serial("id").primaryKey(),
  fromTeamId: integer("from_team_id")
    .notNull()
    .references(() => teams.id),
  toTeamId: integer("to_team_id").references(() => teams.id), // null = broadcast to all
  eventDispatchId: integer("event_dispatch_id").references(() => eventDispatches.id),
  messageText: text("message_text").notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export const instructorActions = pgTable("instructor_actions", {
  id: serial("id").primaryKey(),
  instructorUserId: integer("instructor_user_id")
    .notNull()
    .references(() => users.id),
  actionType: text("action_type").notNull(),
  targetDesc: text("target_desc").notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Drives the public-display scrolling ticker
export const globalFeedItems = pgTable("global_feed_items", {
  id: serial("id").primaryKey(),
  headlineText: text("headline_text").notNull(),
  eventDispatchId: integer("event_dispatch_id").references(() => eventDispatches.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Private per-team "what just happened to you" feed — one row per scored
// decision (the templated consequence card, built from the event's existing
// consequencesJson prose, see lib/consequences.ts) plus snap-vote and pledge
// notifications. Surfaced on the team dashboard; distinct from
// globalFeedItems, which is the shared projector ticker.
export const teamNotifications = pgTable("team_notifications", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id),
  eventDispatchId: integer("event_dispatch_id").references(() => eventDispatches.id),
  kind: text("kind").notNull().default("consequence"), // consequence | snap_vote | pledge | market | trade | budget_cycle | emergency_funding | decision_revealed
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Resource pledge ledger — turns the previously narrative-only "we'll share
// PPE/funds/HCW capacity" decisions into an actual transfer between two
// regions' live model_state resource fields. Visible to everyone (same
// transparency model as coordination_messages).
export const resourcePledges = pgTable("resource_pledges", {
  id: serial("id").primaryKey(),
  fromTeamId: integer("from_team_id")
    .notNull()
    .references(() => teams.id),
  toTeamId: integer("to_team_id")
    .notNull()
    .references(() => teams.id),
  resourceType: resourceTypeEnum("resource_type").notNull(),
  amount: integer("amount").notNull(),
  eventDispatchId: integer("event_dispatch_id").references(() => eventDispatches.id),
  createdByUserId: integer("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Facilitator "break-glass" synchronous snap vote — a wildcard pressure tool
// separate from the scripted event queue (see lib/snap-vote.ts). One open
// vote at a time; closing it applies a small generic model effect based on
// participation/agreement rather than a per-question authored consequence.
export const snapVotes = pgTable("snap_votes", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  optionsJson: jsonb("options_json").notNull(), // string[]
  createdByUserId: integer("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  closesAt: timestamp("closes_at").notNull(),
  status: snapVoteStatusEnum("status").notNull().default("open"),
  resultSummary: text("result_summary"),
});

export const snapVoteResponses = pgTable(
  "snap_vote_responses",
  {
    id: serial("id").primaryKey(),
    snapVoteId: integer("snap_vote_id")
      .notNull()
      .references(() => snapVotes.id),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    choice: text("choice").notNull(),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("snap_vote_responses_vote_team_uniq").on(t.snapVoteId, t.teamId)]
);

// Popup announcements — see lib/announcements.ts. Two scopes:
// "global_display" rows are transient (auto-dismiss after
// autoDismissSeconds, tracked purely by elapsed time, no ack needed —
// they're on a shared projector, not tied to any one viewer).
// "team" rows persist until that team explicitly closes them (see
// announcementAcks below) since a missed in-app popup is easy for a
// student to miss entirely otherwise.
export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  scope: announcementScopeEnum("scope").notNull(),
  kind: text("kind").notNull(), // "event_dispatched" | "decision_resolved"
  eventId: text("event_id").references(() => events.id),
  targetTeamIds: jsonb("target_team_ids"), // number[] | null (null = all teams; scope="team" only)
  title: text("title").notNull(),
  message: text("message").notNull(),
  autoDismissSeconds: integer("auto_dismiss_seconds"), // set for scope="global_display"; null for scope="team"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const announcementAcks = pgTable(
  "announcement_acks",
  {
    id: serial("id").primaryKey(),
    announcementId: integer("announcement_id")
      .notNull()
      .references(() => announcements.id),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    ackedAt: timestamp("acked_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("announcement_acks_uniq").on(t.announcementId, t.teamId)]
);

// Periodic budget cycle (item 2) — see lib/budget-cycle.ts. Fires every 14
// narrative days. The instructor picks one of three modes when it's due:
// push the default disbursement silently, adjust amounts before pushing, or
// open a snap-vote-style window where each region can accept the default or
// request more — and if anyone requests more, a second window asks every
// OTHER region how much of their own disbursement they want to donate.
export const budgetCycles = pgTable("budget_cycles", {
  id: serial("id").primaryKey(),
  cycleNumber: integer("cycle_number").notNull(),
  narrativeDayDue: real("narrative_day_due").notNull(),
  status: budgetCycleStatusEnum("status").notNull().default("pending_instructor"),
  mode: budgetCycleModeEnum("mode"),
  closesAt: timestamp("closes_at"), // response/donation window deadline, when mode = snap_vote
  createdAt: timestamp("created_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
});

export const budgetCycleResponses = pgTable(
  "budget_cycle_responses",
  {
    id: serial("id").primaryKey(),
    budgetCycleId: integer("budget_cycle_id")
      .notNull()
      .references(() => budgetCycles.id),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    choice: budgetChoiceEnum("choice").notNull(),
    requestedAmount: integer("requested_amount"), // set when choice = request_more
    amountDisbursed: integer("amount_disbursed"), // final amount, set at cycle close
    respondedAt: timestamp("responded_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("budget_cycle_responses_uniq").on(t.budgetCycleId, t.teamId)]
);

export const budgetCycleDonations = pgTable(
  "budget_cycle_donations",
  {
    id: serial("id").primaryKey(),
    budgetCycleId: integer("budget_cycle_id")
      .notNull()
      .references(() => budgetCycles.id),
    fromTeamId: integer("from_team_id")
      .notNull()
      .references(() => teams.id),
    toTeamId: integer("to_team_id")
      .notNull()
      .references(() => teams.id),
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("budget_cycle_donations_uniq").on(t.budgetCycleId, t.fromTeamId, t.toTeamId)]
);

// WHO HQ marketplace (item 3) — regions buy PPE/antivirals from WHO HQ's own
// stockpile at an adaptive price (see lib/economy.ts pricing formula),
// requiring instructor approval. Other regions get a brief heads-up window
// to submit their own request before the instructor processes the batch.
export const marketRequests = pgTable("market_requests", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id")
    .notNull()
    .references(() => teams.id),
  resourceType: marketResourceEnum("resource_type").notNull(),
  amount: integer("amount").notNull(),
  pricePerUnit: real("price_per_unit").notNull(), // locked at request time
  totalCost: integer("total_cost").notNull(),
  status: marketRequestStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedByUserId: integer("resolved_by_user_id").references(() => users.id),
});

// Direct region-to-region purchase offers (item 3, simplified — no
// counter-offers: the receiving region can only accept or reject).
export const regionTradeOffers = pgTable("region_trade_offers", {
  id: serial("id").primaryKey(),
  fromTeamId: integer("from_team_id") // buyer
    .notNull()
    .references(() => teams.id),
  toTeamId: integer("to_team_id") // seller
    .notNull()
    .references(() => teams.id),
  resourceType: marketResourceEnum("resource_type").notNull(),
  amount: integer("amount").notNull(),
  pricePerUnit: real("price_per_unit").notNull(),
  totalPrice: integer("total_price").notNull(),
  status: tradeOfferStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

// Emergency funding requests (item 5) — a team asks all other regions AND
// WHO HQ (which has its own, larger, non-resupplied budget) to help meet a
// funding goal. Stays open until the instructor closes it (facilitator-paced
// rather than a hard timer, unlike the market heads-up window, so it fits
// naturally into however the room is actually moving).
export const emergencyFundingRequests = pgTable("emergency_funding_requests", {
  id: serial("id").primaryKey(),
  requestingTeamId: integer("requesting_team_id")
    .notNull()
    .references(() => teams.id),
  amountRequested: integer("amount_requested").notNull(),
  reason: text("reason").notNull(),
  status: emergencyRequestStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
});

export const emergencyFundingContributions = pgTable(
  "emergency_funding_contributions",
  {
    id: serial("id").primaryKey(),
    requestId: integer("request_id")
      .notNull()
      .references(() => emergencyFundingRequests.id),
    contributorTeamId: integer("contributor_team_id").references(() => teams.id), // null if from WHO HQ
    isWhoHq: boolean("is_who_hq").notNull().default(false),
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("emergency_funding_contributions_uniq").on(t.requestId, t.contributorTeamId, t.isWhoHq)]
);

// De-dupe ledger for the automatic "good direction" social-metric rewards
// (see lib/social-thresholds.ts) — the bad-direction warning/escalation
// arcs are real dispatched events (EVT-017 through EVT-025) that the
// instructor controls the pacing of, but a milestone reward for sustained
// high trust/happiness or low political tension is a no-decision-needed
// bonus applied automatically the same way passive drift is, so it needs
// its own guard against re-awarding on every poll tick. regionId is a
// plain text column (not FK'd to regions) so "GLOBAL" can be used as the
// sentinel for the world-average versions without a NULL-uniqueness
// footgun (Postgres treats NULL as distinct from NULL in unique indexes).
export const socialMilestoneAwards = pgTable(
  "social_milestone_awards",
  {
    id: serial("id").primaryKey(),
    regionId: text("region_id").notNull(), // region code, or "GLOBAL"
    metric: text("metric").notNull(), // "publicTrust" | "happiness" | "politicalTension"
    tier: text("tier").notNull(), // "milestone1" | "milestone2"
    awardedAt: timestamp("awarded_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("social_milestone_awards_uniq").on(t.regionId, t.metric, t.tier)]
);
