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
  loginEmail: text("login_email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
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
  fastModeMultiplier: real("fast_mode_multiplier").notNull().default(1 / 60), // real minutes per stated hour
  respectBlackoutWindow: boolean("respect_blackout_window").notNull().default(false),
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
