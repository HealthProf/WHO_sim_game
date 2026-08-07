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
  index,
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
export const sessionModeEnum = pgEnum("session_mode", ["instructor", "demo"]);
export const sessionStatusEnum = pgEnum("session_status", [
  "setup",
  "running",
  "paused",
  "completed",
  "archived",
]);
// "team" = a real student region login; "owner" = the session owner acting on
// behalf of a region (demo mode, occupying a region themselves); "autoplayer"
// = the scripted demo autoplayer (see lib/autoplayer, Phase 4); "system" =
// automatic no-response fallback (lib/deadline.ts), which has no user at all.
export const actorKindEnum = pgEnum("actor_kind", ["team", "owner", "autoplayer", "system"]);
// Tier-sampling competence distributions for demo mode's scripted
// autoplayer — see lib/config.ts AUTOPLAY_PROFILE_DISTRIBUTIONS and
// lib/autoplayer/scripted.ts.
export const autoplayProfileEnum = pgEnum("autoplay_profile", ["strong", "mixed", "struggling"]);

// Static reference data — seeded once from 04-regions.md. Global across every
// session: never gets a sessionId.
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

// A public account. Region logins are NOT users rows — see
// sessionRegionCredentials below. Stays global/unscoped.
//
// role is legacy from the single-session prototype and is no longer how
// "instructor-ness" is determined — see lib/session-context.ts requireActor:
// a public account becomes the instructor for whichever game_sessions row
// it owns (gameSessions.ownerUserId), not via a fixed role on the account
// itself. Every public account is created with role="student" at the table
// level (kept non-null rather than dropped outright since removing it would
// touch every historical row and isn't needed for Phase 2/3 to work).
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(), // lowercased, unique key
  displayUsername: text("display_username").notNull(), // what they actually typed
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: userRoleEnum("role").notNull(),
  // Optional profile fields (lib/session-context.ts and registration never
  // require these) — used only to contact an account holder about updates
  // to the simulation. email is also the only account-recovery path that
  // exists; see app/(public)/account/recover.
  email: text("email"),
  institution: text("institution"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
});

// Per-IP request throttling for POST /api/account/register and the
// credentials sign-in path (see lib/rate-limit.ts). A DB-backed counter
// rather than an in-memory one — on Vercel each lambda instance gets its
// own memory, so an in-memory limiter is close to decorative. One extra
// atomic write per auth attempt is the accepted cost.
export const rateLimitCounters = pgTable("rate_limit_counters", {
  key: text("key").primaryKey(), // "ip:route", e.g. "203.0.113.4:register"
  windowStartedAt: timestamp("window_started_at").notNull(),
  count: integer("count").notNull().default(0),
});

// Singleton throttle marker (id = 1) for the opportunistic reaper (see
// lib/reaper.ts) — a global, not per-session, cousin of
// sessionState.lastTickAt: reaping scans every session at once, so it needs
// exactly one shared claim rather than one per session.
export const reaperState = pgTable("reaper_state", {
  id: integer("id").primaryKey().default(1),
  lastReapAt: timestamp("last_reap_at"),
});

// Minimal observability log (see lib/session-events.ts) — "47 instructors
// ran a session" is a far more useful thing to be able to say than "it's
// deployed." sessionId is nullable and NOT a FK: a session can be deleted
// (demo sessions, see lib/session-lifecycle.ts deleteSession) after this
// log has already recorded its lifecycle, and the log is meant to outlive
// the session it describes.
export const sessionEvents = pgTable(
  "session_events",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id"),
    kind: text("kind").notNull(), // "created" | "completed" | "archived" | "reaped"
    mode: sessionModeEnum("mode").notNull(),
    detail: text("detail"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("session_events_created_idx").on(t.createdAt)]
);

// One live game. Identity and lifecycle only — see sessionState for the wide,
// hot, per-tick fields (kept in a separate table on purpose: this row is what
// the reaper and concurrency caps scan, and it stays small and rarely
// written even while sessionState is rewritten on every tick).
export const gameSessions = pgTable("game_sessions", {
  id: text("id").primaryKey(), // crypto.randomUUID(), see lib/ids.ts
  ownerUserId: integer("owner_user_id")
    .notNull()
    .references(() => users.id),
  mode: sessionModeEnum("mode").notNull(),
  status: sessionStatusEnum("status").notNull().default("setup"),
  // Unguessable public identifier for the projector display route
  // (crypto.randomBytes(24).toString("base64url"), see lib/ids.ts) —
  // deliberately never the primary key, so the PK never needs to be exposed
  // in a public URL.
  displayToken: text("display_token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  // Bumped by lib/session-context.ts's requireActor() on every authenticated
  // request against this session — drives idle-tick gating and reaping
  // (Phase 5).
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
  // Demo mode only: which region the session owner is currently occupying.
  // null = the owner is acting as the instructor. See lib/session-context.ts
  // requireActor() (Phase 4 wires the override; Phase 1 leaves this column in
  // place but unused by any read path other than the schema itself).
  demoActiveRegionId: text("demo_active_region_id").references(() => regions.id),
});

// Per-session region logins (instructor mode). Generated at session creation
// (lib/session-lifecycle.ts createSession), never chosen by the student.
// Replaces the old teams.username column — see teams below.
export const sessionRegionCredentials = pgTable(
  "session_region_credentials",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    regionId: text("region_id")
      .notNull()
      .references(() => regions.id),
    // Globally unique (not just per-session) because NextAuth's Credentials
    // provider resolves a bare username with no session context — see
    // lib/auth.ts. Generated with a random suffix (e.g. "afro-7f3k9q") so it
    // can never collide with a public users.username.
    username: text("username").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    // Shown once on the credential sheet at creation; kept so the sheet can
    // be re-rendered mid-session (an instructor may need to reprint it).
    // Cleared when the session completes — see lib/session-lifecycle.ts.
    plaintextHint: text("plaintext_hint"),
  },
  (t) => [uniqueIndex("session_region_credentials_session_region_uniq").on(t.sessionId, t.regionId)]
);

// Per-session team row — one per region per session. Was globally unique on
// regionId/username; both constraints break the moment two sessions coexist,
// so this table is now session-scoped and username has moved to
// sessionRegionCredentials above.
export const teams = pgTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    regionId: text("region_id")
      .notNull()
      .references(() => regions.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("teams_session_region_uniq").on(t.sessionId, t.regionId),
    index("teams_session_idx").on(t.sessionId),
  ]
);

// Per-session game state. Structurally identical to the old global_state
// singleton (id = 1) — every column below is byte-identical in meaning, just
// addressed by sessionId instead of a hardcoded id. Deliberately kept as its
// own table rather than merged into gameSessions: it's wide and rewritten on
// every tick, while gameSessions is small and rarely written (the reaper and
// concurrency caps scan gameSessions, not this table).
export const sessionState = pgTable("session_state", {
  sessionId: text("session_id")
    .primaryKey()
    .references(() => gameSessions.id),
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
  // Throttle guard for processDeadlines()'s opportunistic subsystem tick
  // (lib/deadline.ts) — up to ~8 clients (6 team dashboards, the projector,
  // the instructor console) can all poll within the same second, and
  // without this every one of them would separately re-run snap-vote
  // expiry, budget-cycle timers, and social-milestone checks. Claimed via a
  // single atomic conditional UPDATE (same pattern as lib/db-atomic.ts),
  // not a real lock, so at most one caller per throttle window does the
  // work and the rest no-op. Scoped per session so concurrent sessions tick
  // independently.
  lastTickAt: timestamp("last_tick_at"),
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
  // Item 9's "drama dial" — a single live-adjustable knob (0.5x-2x) the
  // instructor can nudge mid-session, independent of fastModeMultiplier
  // (which is a fixed session-setup pacing choice, not something meant to
  // change live). Scales three things together: passive Rt drift rate
  // (lib/model-engine.ts), WHO HQ marketplace price escalation
  // (lib/economy.ts), and deadline window length (lib/deadline.ts, inverted
  // — higher intensity means shorter windows). One control instead of three
  // separate ones so a facilitator who senses the room coasting can turn up
  // the pressure without hunting through multiple settings.
  intensityMultiplier: real("intensity_multiplier").notNull().default(1.0),
  // Bumped by a single atomic increment on every mutating write this
  // session makes (see lib/state-version.ts) — /api/dashboard and
  // /api/display accept ?since=<version> and return { unchanged: true }
  // without recomputing anything when nothing has changed, so an idle
  // session's polling costs close to nothing (Phase 5 poll backoff).
  stateVersion: integer("state_version").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Current live state per region, per session.
export const modelState = pgTable(
  "model_state",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    regionId: text("region_id")
      .notNull()
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
  },
  (t) => [
    uniqueIndex("model_state_session_region_uniq").on(t.sessionId, t.regionId),
    index("model_state_session_idx").on(t.sessionId),
  ]
);

// A parallel "what if every decision had been Optimal" shadow simulation,
// updated in lockstep with model_state (see lib/model-engine.ts) — every
// scored decision applies its OPTIMAL-tier delta here regardless of what
// tier actually happened, and the same epidemic-progression/drift formula
// runs against this table's own Rt/CFR. This is what powers the debrief's
// "actual vs. achievable" comparison (item 7) without needing to replay the
// whole game's history after the fact.
export const modelStateOptimal = pgTable(
  "model_state_optimal",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    regionId: text("region_id")
      .notNull()
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
  },
  (t) => [
    uniqueIndex("model_state_optimal_session_region_uniq").on(t.sessionId, t.regionId),
    index("model_state_optimal_session_idx").on(t.sessionId),
  ]
);

// Append-only log — critical for after-action reports
export const modelStateHistory = pgTable(
  "model_state_history",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    regionId: text("region_id")
      .notNull()
      .references(() => regions.id),
    day: integer("day").notNull(),
    snapshotJson: jsonb("snapshot_json").notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("model_state_history_session_idx").on(t.sessionId)]
);

// Static reference data — seeded once from 03-events.md. Global across every
// session: never gets a sessionId.
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
export const eventDispatches = pgTable(
  "event_dispatches",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
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
  },
  (t) => [index("event_dispatches_session_idx").on(t.sessionId)]
);

export const decisions = pgTable(
  "decisions",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    eventDispatchId: integer("event_dispatch_id")
      .notNull()
      .references(() => eventDispatches.id),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    // Null for autoplayer/system-generated decisions — see actorKind.
    submittedByUserId: integer("submitted_by_user_id").references(() => users.id),
    // What kind of thing submitted this decision: a real team login, the demo
    // session owner occupying the region, the scripted autoplayer (Phase 4),
    // or the automatic no-response fallback (lib/deadline.ts).
    actorKind: actorKindEnum("actor_kind").notNull().default("team"),
    structuredChoice: text("structured_choice"),
    rationaleText: text("rationale_text").notNull(),
    resourceAllocationJson: jsonb("resource_allocation_json"),
    coordinatedWithTeamsJson: jsonb("coordinated_with_teams_json"),
    // Self-reported confidence in this decision ("calibration wager" — see
    // lib/scoring.ts computeCalibrationAdjustment). Null for system-generated
    // no-response fallback decisions, which carry no calibration signal.
    confidenceLevel: confidenceLevelEnum("confidence_level"),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  },
  (t) => [index("decisions_session_idx").on(t.sessionId)]
);

export const scores = pgTable(
  "scores",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
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
  },
  (t) => [index("scores_session_idx").on(t.sessionId)]
);

export const coordinationMessages = pgTable(
  "coordination_messages",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    fromTeamId: integer("from_team_id")
      .notNull()
      .references(() => teams.id),
    toTeamId: integer("to_team_id").references(() => teams.id), // null = broadcast to all
    eventDispatchId: integer("event_dispatch_id").references(() => eventDispatches.id),
    messageText: text("message_text").notNull(),
    sentAt: timestamp("sent_at").defaultNow().notNull(),
    // Item 6's diplomatic back-channel: a private (toTeamId set) message has a
    // small random chance of "leaking" to the public projector feed at send
    // time — see lib/coordination-leak.ts. Broadcasts (toTeamId null) can
    // never leak, they're already public.
    leaked: boolean("leaked").notNull().default(false),
  },
  (t) => [index("coordination_messages_session_idx").on(t.sessionId)]
);

export const instructorActions = pgTable(
  "instructor_actions",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    instructorUserId: integer("instructor_user_id")
      .notNull()
      .references(() => users.id),
    actionType: text("action_type").notNull(),
    targetDesc: text("target_desc").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("instructor_actions_session_idx").on(t.sessionId)]
);

// Drives the public-display scrolling ticker
export const globalFeedItems = pgTable(
  "global_feed_items",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    headlineText: text("headline_text").notNull(),
    eventDispatchId: integer("event_dispatch_id").references(() => eventDispatches.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("global_feed_items_session_idx").on(t.sessionId)]
);

// Private per-team "what just happened to you" feed — one row per scored
// decision (the templated consequence card, built from the event's existing
// consequencesJson prose, see lib/consequences.ts) plus snap-vote and pledge
// notifications. Surfaced on the team dashboard; distinct from
// globalFeedItems, which is the shared projector ticker.
export const teamNotifications = pgTable(
  "team_notifications",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    eventDispatchId: integer("event_dispatch_id").references(() => eventDispatches.id),
    kind: text("kind").notNull().default("consequence"), // consequence | snap_vote | pledge | market | trade | budget_cycle | emergency_funding | decision_revealed
    message: text("message").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("team_notifications_session_idx").on(t.sessionId)]
);

// Resource pledge ledger — turns the previously narrative-only "we'll share
// PPE/funds/HCW capacity" decisions into an actual transfer between two
// regions' live model_state resource fields. Visible to everyone (same
// transparency model as coordination_messages).
export const resourcePledges = pgTable(
  "resource_pledges",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    fromTeamId: integer("from_team_id")
      .notNull()
      .references(() => teams.id),
    toTeamId: integer("to_team_id")
      .notNull()
      .references(() => teams.id),
    resourceType: resourceTypeEnum("resource_type").notNull(),
    amount: integer("amount").notNull(),
    eventDispatchId: integer("event_dispatch_id").references(() => eventDispatches.id),
    // Null for autoplayer/system-generated pledges — see actorKind on decisions.
    createdByUserId: integer("created_by_user_id").references(() => users.id),
    actorKind: actorKindEnum("actor_kind").notNull().default("team"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("resource_pledges_session_idx").on(t.sessionId)]
);

// Facilitator "break-glass" synchronous snap vote — a wildcard pressure tool
// separate from the scripted event queue (see lib/snap-vote.ts). One open
// vote at a time per session; closing it applies a small generic model effect
// based on participation/agreement rather than a per-question authored
// consequence.
export const snapVotes = pgTable(
  "snap_votes",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    question: text("question").notNull(),
    optionsJson: jsonb("options_json").notNull(), // string[]
    createdByUserId: integer("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    closesAt: timestamp("closes_at").notNull(),
    status: snapVoteStatusEnum("status").notNull().default("open"),
    resultSummary: text("result_summary"),
  },
  (t) => [index("snap_votes_session_idx").on(t.sessionId)]
);

export const snapVoteResponses = pgTable(
  "snap_vote_responses",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    snapVoteId: integer("snap_vote_id")
      .notNull()
      .references(() => snapVotes.id),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    choice: text("choice").notNull(),
    submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("snap_vote_responses_session_vote_team_uniq").on(t.sessionId, t.snapVoteId, t.teamId),
    index("snap_vote_responses_session_idx").on(t.sessionId),
  ]
);

// Popup announcements — see lib/announcements.ts. Two scopes:
// "global_display" rows are transient (auto-dismiss after
// autoDismissSeconds, tracked purely by elapsed time, no ack needed —
// they're on a shared projector, not tied to any one viewer).
// "team" rows persist until that team explicitly closes them (see
// announcementAcks below) since a missed in-app popup is easy for a
// student to miss entirely otherwise.
export const announcements = pgTable(
  "announcements",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    scope: announcementScopeEnum("scope").notNull(),
    kind: text("kind").notNull(), // "event_dispatched" | "decision_resolved" | "dramatic_moment" | "interjection"
    eventId: text("event_id").references(() => events.id),
    // number[] | null (null = all teams; scope="team" only) — team ids inside
    // are only meaningful within this row's own session, which is fine once
    // the row itself is session-scoped.
    targetTeamIds: jsonb("target_team_ids"),
    title: text("title").notNull(),
    message: text("message").notNull(),
    autoDismissSeconds: integer("auto_dismiss_seconds"), // set for scope="global_display"; null for scope="team"
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("announcements_session_idx").on(t.sessionId)]
);

export const announcementAcks = pgTable(
  "announcement_acks",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    announcementId: integer("announcement_id")
      .notNull()
      .references(() => announcements.id),
    teamId: integer("team_id")
      .notNull()
      .references(() => teams.id),
    ackedAt: timestamp("acked_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("announcement_acks_session_uniq").on(t.sessionId, t.announcementId, t.teamId),
    index("announcement_acks_session_idx").on(t.sessionId),
  ]
);

// Periodic budget cycle (item 2) — see lib/budget-cycle.ts. Fires every 14
// narrative days. The instructor picks one of three modes when it's due:
// push the default disbursement silently, adjust amounts before pushing, or
// open a snap-vote-style window where each region can accept the default or
// request more — and if anyone requests more, a second window asks every
// OTHER region how much of their own disbursement they want to donate.
export const budgetCycles = pgTable(
  "budget_cycles",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    cycleNumber: integer("cycle_number").notNull(),
    narrativeDayDue: real("narrative_day_due").notNull(),
    status: budgetCycleStatusEnum("status").notNull().default("pending_instructor"),
    mode: budgetCycleModeEnum("mode"),
    closesAt: timestamp("closes_at"), // response/donation window deadline, when mode = snap_vote
    createdAt: timestamp("created_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
  },
  (t) => [index("budget_cycles_session_idx").on(t.sessionId)]
);

export const budgetCycleResponses = pgTable(
  "budget_cycle_responses",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
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
  (t) => [
    uniqueIndex("budget_cycle_responses_session_uniq").on(t.sessionId, t.budgetCycleId, t.teamId),
    index("budget_cycle_responses_session_idx").on(t.sessionId),
  ]
);

export const budgetCycleDonations = pgTable(
  "budget_cycle_donations",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
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
  (t) => [
    uniqueIndex("budget_cycle_donations_session_uniq").on(
      t.sessionId,
      t.budgetCycleId,
      t.fromTeamId,
      t.toTeamId
    ),
    index("budget_cycle_donations_session_idx").on(t.sessionId),
  ]
);

// WHO HQ marketplace (item 3) — regions buy PPE/antivirals from WHO HQ's own
// stockpile at an adaptive price (see lib/economy.ts pricing formula),
// requiring instructor approval. Other regions get a brief heads-up window
// to submit their own request before the instructor processes the batch.
export const marketRequests = pgTable(
  "market_requests",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
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
  },
  (t) => [index("market_requests_session_idx").on(t.sessionId)]
);

// Direct region-to-region purchase offers (item 3, simplified — no
// counter-offers: the receiving region can only accept or reject).
export const regionTradeOffers = pgTable(
  "region_trade_offers",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
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
  },
  (t) => [index("region_trade_offers_session_idx").on(t.sessionId)]
);

// Emergency funding requests (item 5) — a team asks all other regions AND
// WHO HQ (which has its own, larger, non-resupplied budget) to help meet a
// funding goal. Stays open until the instructor closes it (facilitator-paced
// rather than a hard timer, unlike the market heads-up window, so it fits
// naturally into however the room is actually moving).
export const emergencyFundingRequests = pgTable(
  "emergency_funding_requests",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    requestingTeamId: integer("requesting_team_id")
      .notNull()
      .references(() => teams.id),
    amountRequested: integer("amount_requested").notNull(),
    reason: text("reason").notNull(),
    status: emergencyRequestStatusEnum("status").notNull().default("open"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
  },
  (t) => [index("emergency_funding_requests_session_idx").on(t.sessionId)]
);

export const emergencyFundingContributions = pgTable(
  "emergency_funding_contributions",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    requestId: integer("request_id")
      .notNull()
      .references(() => emergencyFundingRequests.id),
    contributorTeamId: integer("contributor_team_id").references(() => teams.id), // null if from WHO HQ
    isWhoHq: boolean("is_who_hq").notNull().default(false),
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("emergency_funding_contributions_session_uniq").on(
      t.sessionId,
      t.requestId,
      t.contributorTeamId,
      t.isWhoHq
    ),
    index("emergency_funding_contributions_session_idx").on(t.sessionId),
  ]
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
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    regionId: text("region_id").notNull(), // region code, or "GLOBAL"
    metric: text("metric").notNull(), // "publicTrust" | "happiness" | "politicalTension"
    tier: text("tier").notNull(), // "milestone1" | "milestone2"
    awardedAt: timestamp("awarded_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("social_milestone_awards_session_uniq").on(t.sessionId, t.regionId, t.metric, t.tier),
    index("social_milestone_awards_session_idx").on(t.sessionId),
  ]
);

// Demo mode only: which competence profile the scripted autoplayer uses for
// a region it's driving, and whether it's currently enabled at all (it's
// disabled for whichever region the session owner is actively occupying —
// see gameSessions.demoActiveRegionId and lib/autoplayer/scripted.ts).
// Assigned with variety at session creation (lib/session-lifecycle.ts) so
// no two demo runs feel identical.
export const sessionRegionAutoplay = pgTable(
  "session_region_autoplay",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    regionId: text("region_id")
      .notNull()
      .references(() => regions.id),
    profile: autoplayProfileEnum("profile").notNull(),
    enabled: boolean("enabled").notNull().default(true),
  },
  (t) => [
    uniqueIndex("session_region_autoplay_session_region_uniq").on(t.sessionId, t.regionId),
    index("session_region_autoplay_session_idx").on(t.sessionId),
  ]
);

// Instructor-only engagement analytics — never rendered to any player or
// instructor UI, purely for the maintainer to later export (Vercel's
// Storage tab -> the Neon project's SQL editor) and analyze offline. Demo
// sessions are never written here at all (see lib/analytics.ts) rather than
// filtered at query time, so an export can never accidentally include them.
//
// sessionId is NOT a foreign key and nullable, deliberately mirroring
// sessionEvents above: this log is meant to outlive the session it
// describes (lib/reaper.ts deletes archived sessions, and everything they
// own, well before anyone gets around to analyzing them).
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id"),
    eventType: text("event_type").notNull(), // e.g. "decision_submitted", "trade_proposed" — see lib/analytics.ts for the fixed set
    actorRole: text("actor_role"), // "instructor" | "student", null for pre-session events
    regionId: text("region_id"), // region code, not a FK — see sessionId above
    userId: integer("user_id").references(() => users.id), // users are never deleted, so this FK is safe
    metadataJson: jsonb("metadata_json"), // small event-specific payload, e.g. {resourceType, amount}
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("analytics_events_session_idx").on(t.sessionId),
    index("analytics_events_type_idx").on(t.eventType),
    index("analytics_events_created_idx").on(t.createdAt),
  ]
);

// One row per non-demo session, capturing final outcomes (infections,
// deaths, resources, and the actual-vs-optimal comparison — see
// lib/final-results.ts) before lib/reaper.ts deletes the session's live
// rows (modelState, teams, etc.) for good. Written once when the
// instructor marks the simulation "completed" (PATCH
// /api/instructor/simulation), and again defensively right before the
// reaper deletes an archived session that was never explicitly completed —
// upserted on sessionId so either path can supersede the other with the
// latest numbers. Never written for demo sessions.
// Easter-egg cheat codes (see components/cheat-code-widget.tsx) — deliberately
// undocumented in any UI copy. cheatCodeAttempts tracks consecutive *failed*
// entries per actor so five bad guesses trigger a global "someone's trying
// cheat codes" callout (see lib/cheat-engine.ts); it resets to 0 on both a
// correct entry and after the callout fires, so it's "every 5 failures", not
// a lifetime counter. cheatCodeRedemptions is a plain audit/idempotency log
// (e.g. the one-time $30M grant checks it before crediting again).
export const cheatCodeAttempts = pgTable(
  "cheat_code_attempts",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    actorKey: text("actor_key").notNull(), // "instructor" | region code
    failCount: integer("fail_count").notNull().default(0),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("cheat_code_attempts_session_actor_uniq").on(t.sessionId, t.actorKey),
    index("cheat_code_attempts_session_idx").on(t.sessionId),
  ]
);

export const cheatCodeRedemptions = pgTable(
  "cheat_code_redemptions",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    code: text("code").notNull(), // internal key, e.g. "FUNDS_30M" — see lib/cheat-codes.ts
    actorKey: text("actor_key").notNull(),
    regionId: text("region_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    // Only ever inserted for one-time-per-actor codes (currently FUNDS_30M) —
    // guarded with onConflictDoNothing() at the insert site so a repeat
    // redemption attempt is a safe no-op rather than a thrown constraint
    // error. Repeatable codes (GOD_MODE, BARREL_ROLL, ...) never insert here
    // at all, so this constraint never applies to them.
    uniqueIndex("cheat_code_redemptions_session_code_actor_uniq").on(t.sessionId, t.code, t.actorKey),
    index("cheat_code_redemptions_session_idx").on(t.sessionId),
  ]
);

// Session-wide cheat effects — one row per session. godModeActive is purely
// informational (the actual effect is sessionState.intensityMultiplier,
// which the cheat sets directly, bypassing the tempo dial's normal
// MIN/MAX_INTENSITY_MULTIPLIER clamp — see app/api/cheat/execute/route.ts).
// barrelRollAt is a broadcast timestamp: every poller (dashboard, instructor
// console, projector) that hasn't already animated this exact timestamp
// plays the roll once, client-side. monologueStartedAt/monologuePrevStatus
// back the "one shot to rule them all" full-game pause — see
// lib/cheat-engine.ts resolveCheatMonologue.
export const cheatCodeState = pgTable("cheat_code_state", {
  sessionId: text("session_id")
    .primaryKey()
    .references(() => gameSessions.id),
  godModeActive: boolean("god_mode_active").notNull().default(false),
  barrelRollAt: timestamp("barrel_roll_at"),
  monologueActive: boolean("monologue_active").notNull().default(false),
  monologueStartedAt: timestamp("monologue_started_at"),
  monologuePrevStatus: simStatusEnum("monologue_prev_status"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Per-region cheat effect: the "revert to zero over 14 game days" code.
// Deliberately never touches modelState's real deaths/confirmedCases (the
// activating user is only ever promised a *displayed* reversion) — this row
// just holds the taper's starting point and phase, and app/api/dashboard +
// app/api/display's response mapping computes the overridden display numbers
// from it on every poll (see lib/cheat-engine.ts computeRevertOverride).
// revertPhase: "counting_down" (tapering toward zero) -> "revealed_winner"
// (holds at zero for the 5s "you won" beat) -> the row is cleared
// (revertActive=false) once "Just Kidding!" fires and real numbers resume.
export const cheatRegionEffects = pgTable(
  "cheat_region_effects",
  {
    id: serial("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => gameSessions.id),
    regionId: text("region_id")
      .notNull()
      .references(() => regions.id),
    revertActive: boolean("revert_active").notNull().default(false),
    revertStartedAt: timestamp("revert_started_at"),
    revertStartConfirmed: integer("revert_start_confirmed"),
    revertStartDeaths: integer("revert_start_deaths"),
    revertPhase: text("revert_phase"), // "counting_down" | "revealed_winner"
    revertPhaseAt: timestamp("revert_phase_at"),
  },
  (t) => [
    uniqueIndex("cheat_region_effects_session_region_uniq").on(t.sessionId, t.regionId),
    index("cheat_region_effects_session_idx").on(t.sessionId),
  ]
);

export const gameSessionSnapshots = pgTable("game_session_snapshots", {
  sessionId: text("session_id").primaryKey(),
  reason: text("reason").notNull(), // "completed" | "reaped"
  sessionCreatedAt: timestamp("session_created_at").notNull(),
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
  currentDay: integer("current_day").notNull(),
  totalGameDays: integer("total_game_days").notNull(),
  escalationState: escalationStateEnum("escalation_state").notNull(),
  mediaPressureIndex: integer("media_pressure_index").notNull(),
  whoHqFund: integer("who_hq_fund").notNull(),
  whoHqPpeStock: integer("who_hq_ppe_stock").notNull(),
  whoHqAntiviralsStock: integer("who_hq_antivirals_stock").notNull(),
  teamCount: integer("team_count").notNull(),
  // Per-region final state (confirmed cases, deaths, Rt, resources, social
  // metrics) plus each region's actual-vs-optimal comparison — see
  // RegionFinalResult in lib/final-results.ts for the shape.
  regionResultsJson: jsonb("region_results_json").notNull(),
  totalActualConfirmed: integer("total_actual_confirmed").notNull(),
  totalActualDeaths: integer("total_actual_deaths").notNull(),
  totalOptimalConfirmed: integer("total_optimal_confirmed").notNull(),
  totalOptimalDeaths: integer("total_optimal_deaths").notNull(),
  totalInfectionsPrevented: integer("total_infections_prevented").notNull(),
  totalDeathsPrevented: integer("total_deaths_prevented").notNull(),
});
