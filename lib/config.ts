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

// --- Per-IP rate limiting (lib/rate-limit.ts) ---
// Applied to POST /api/account/register and the credentials sign-in path.
// A DB-backed fixed window, not a sliding one — simple, and "at most N
// attempts per window" is all this needs to guard against.
export const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
export const RATE_LIMIT_MAX_ATTEMPTS = 10;

// --- Demo mode pacing (lib/session-lifecycle.ts, Phase 4) ---
// A demo session runs on a faster clock than an instructor session so a
// solo visitor can finish an arc in ~10-15 minutes. gameDaysPerRealMinute
// governs the narrative-day clock; fastModeMultiplier governs individual
// event deadline windows only (see sessionState's schema comments — the two
// are deliberately independent). Tuned by actually running a demo, not by
// arithmetic alone — revisit if a run consistently feels too short/long.
export const DEMO_GAME_DAYS_PER_REAL_MINUTE = 6;
export const DEMO_FAST_MODE_MULTIPLIER = 1 / 240;

// --- Scripted autoplayer tier-sampling profiles (lib/autoplayer/scripted.ts) ---
// Each profile is a probability distribution over the four scoring tiers,
// sampled once per decision. Assigned with variety across a demo session's
// five AI-driven regions at creation (lib/session-lifecycle.ts).
export const AUTOPLAY_PROFILE_DISTRIBUTIONS: Record<"strong" | "mixed" | "struggling", Record<"OPTIMAL" | "ADEQUATE" | "INADEQUATE" | "CRITICAL_FAILURE", number>> = {
  strong: { OPTIMAL: 0.6, ADEQUATE: 0.3, INADEQUATE: 0.1, CRITICAL_FAILURE: 0.0 },
  mixed: { OPTIMAL: 0.25, ADEQUATE: 0.45, INADEQUATE: 0.25, CRITICAL_FAILURE: 0.05 },
  struggling: { OPTIMAL: 0.05, ADEQUATE: 0.3, INADEQUATE: 0.45, CRITICAL_FAILURE: 0.2 },
};
// A "struggling" region occasionally misses a deadline entirely (see
// lib/autoplayer/scripted.ts) so the existing hard-deadline auto-fallback
// consequences (lib/deadline.ts) visibly fire during a demo.
export const AUTOPLAY_STRUGGLING_MISS_CHANCE = 0.15;

// --- Scaling hygiene (Phase 5) ---
// A session stops ticking (lib/deadline.ts processDeadlines) once idle this
// long — polls still return current state, they just stop doing work.
export const IDLE_TICK_CUTOFF_MINUTES = 30;
// Reaping thresholds (lib/reaper.ts). An idle-past-tick-cutoff session isn't
// archived yet — only once it's been idle a full day. Demo sessions are
// deletable once archived (nothing to preserve); instructor sessions are
// kept far longer since a facilitator may want the debrief data after class.
export const REAP_ARCHIVE_IDLE_HOURS = 24;
export const REAP_DELETE_DEMO_AFTER_ARCHIVE_HOURS = 24;
export const REAP_DELETE_INSTRUCTOR_AFTER_ARCHIVE_HOURS = 24 * 30; // ~30 days
// The reaper itself only actually scans this often, via a single shared
// throttle marker (reaperState), so it doesn't re-run on every poll.
export const REAP_THROTTLE_MINUTES = 10;

// --- Concurrency caps (lib/session-lifecycle.ts createSession) ---
// Per-user: enforced today by POST /api/sessions refusing a second active
// session of the same mode (see its own comment) — reusing/archiving the
// old one instead of silently destroying it is left as a manual step for
// now. This is the global ceiling across every account, meant to keep a
// free-tier Neon/Vercel deployment from falling over under a traffic spike
// rather than degrading gracefully.
export const MAX_CONCURRENT_ACTIVE_SESSIONS = 40;

// --- Poll backoff (app/api/dashboard, app/api/display, lib/fetcher.ts) ---
// Suggested next-poll delay when a ?since=<version> request comes back
// unchanged — roughly double the normal ~15s dashboard interval, so an idle
// session's polling traffic (and the work it would otherwise trigger) drops
// without going so slack that a change feels laggy to notice.
export const POLL_BACKOFF_MS = 30_000;
