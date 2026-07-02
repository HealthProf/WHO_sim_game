// Tunable simulation-pacing knobs, collected in one place so a facilitator
// tuning session-length/difficulty doesn't require hunting through the
// engine, budget-cycle, deadline, and announcement modules individually.
// Constants that are pure implementation detail (e.g. the passive-drift
// epidemiological model's internal rate constants in lib/model-engine.ts)
// stay local to their module — this file is for values someone would
// plausibly want to retune between sessions.

// --- Poll-tick throttle (lib/deadline.ts) ---
// Floor between opportunistic tick-driven subsystem runs (passive drift,
// snap-vote expiry, budget-cycle timers, social milestones) — bounds load
// under concurrent polling without serializing callers against each other.
export const TICK_THROTTLE_SECONDS = 3;

// --- Budget cycle (lib/budget-cycle.ts) ---
export const BUDGET_CYCLE_INTERVAL_NARRATIVE_DAYS = 14;
export const BUDGET_DEFAULT_DISBURSEMENT_PCT = 0.12;
export const BUDGET_RESPONSE_WINDOW_SECONDS = 90;
export const BUDGET_DONATION_WINDOW_SECONDS = 90;

// --- Announcements (lib/announcements.ts) ---
export const ANNOUNCEMENT_AUTO_DISMISS_SECONDS = 10;
export const DRAMATIC_MOMENT_AUTO_DISMISS_SECONDS = 18;

// --- Tempo dial / drama dial (item 9) ---
export const MIN_INTENSITY_MULTIPLIER = 0.5;
export const MAX_INTENSITY_MULTIPLIER = 2.0;

// --- Diplomatic back-channel (item 6, app/api/coordination/route.ts) ---
// Chance a private message between two regions gets publicly leaked,
// rolled once at send time.
export const COORDINATION_LEAK_CHANCE = 0.15;

// --- Political tension / WHO HQ cooperation lockout (lib/economy.ts) ---
export const POLITICAL_TENSION_LOCKOUT_THRESHOLD = 90;
