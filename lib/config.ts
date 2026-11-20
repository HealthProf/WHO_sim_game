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

// --- Cheat codes (lib/cheat-engine.ts) ---
// BARREL_ROLL's barrelRollAt is a broadcast timestamp with no separate
// "clear" step — every poller within this many seconds of the timestamp
// plays the roll once; anyone loading later sees nothing. Comfortably wider
// than the widest cheat-relevant poll interval (the 4s display default) so
// a normal poll never misses the window, but short enough that reopening a
// session minutes/days later never replays a stale roll.
export const BARREL_ROLL_BROADCAST_WINDOW_SECONDS = 15;

// --- Scenario Overview slide deck (lib/use-scenario-overview.ts) ---
// scenarioOverviewStartedAt is set this many seconds in the future, not to
// "now", when the deck is triggered (session creation, the credential
// sheet's button, a reset). Every connected client discovers the trigger
// asynchronously — a poll cycle, a page load after login — and without this
// buffer that discovery latency ate directly into slide 1's on-screen time,
// sometimes down to just a couple of seconds. Comfortably covers a normal
// DB round-trip + client poll/render without feeling like a laggy delay
// before anything appears (a client that discovers the deck before this
// instant just shows slide 1 immediately — see the hook's negative-elapsed
// clamp — rather than a blank screen).
export const SCENARIO_OVERVIEW_PREROLL_SECONDS = 4;

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

// Sign-in specifically (lib/auth.ts authorize()) uses two separate budgets
// instead of the single shared-key counter above: a tight per-credential
// ceiling that only counts failed attempts, and a much looser per-IP
// ceiling as a backstop against one source enumerating many usernames. This
// is what actually fixes "a classroom behind one NAT IP locks itself out" —
// see the fix's commit message for the incident this traces back to.
export const SIGNIN_MAX_ATTEMPTS_PER_CREDENTIAL = 10;
export const SIGNIN_IP_MAX_ATTEMPTS = 100;

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

// --- Game duration and decision windows (Release 1) ---
// Total *play* time a class session is paced to (briefing and debrief are
// extra). The facilitator can change it before or during the game; see
// lib/game-duration.ts for how a mid-game change avoids jumping the clock.
export const CLASS_DEFAULT_DURATION_MINUTES = 75;
export const DURATION_MIN_MINUTES = 20;
export const DURATION_MAX_MINUTES = 180;
// A mid-game duration change always leaves at least this much play time, so
// shrinking the duration below what has already elapsed can't make the
// remaining narrative days race by in seconds.
export const DURATION_MIN_REMAINING_MINUTES = 5;
// Every timed event in a class session gets this many minutes of reading and
// writing time on top of its stated deadline hours (1 real minute per stated
// hour, the existing fastModeMultiplier). The seeded 2-6 hour windows become
// 7-11 minutes, sized for reading the brief, discussing, and writing a
// 2-5 sentence rationale. Demo sessions don't use this (solo pacing is
// unchanged).
export const CLASS_DECISION_WINDOW_BASE_MINUTES = 5;
// Bounds for the facilitator's decision-time slider.
export const DECISION_TIME_MIN_MULTIPLIER = 0.5;
export const DECISION_TIME_MAX_MULTIPLIER = 2.0;
// "Add time" button on the Command Center: extends every open event by this.
export const EXTEND_OPEN_EVENTS_MINUTES = 2;

// --- Release 2: rationale, grading, outcomes, feature phase-in ---
// Recommended rationale length, capped from the source design's 150-400
// words to roughly 2-5 sentences so teams can write it inside a 7-11 minute
// window (lib/auto-grade.ts effectiveMinWords). Not required to submit: a
// shorter rationale only lowers the provisional grade's evidence score, so
// rushed teams and fast test games can still get a choice in.
export const RATIONALE_MIN_WORDS_CAP = 40;
// Optional "auto-accept provisional scores" (facilitator toggle): a team's
// submission is scored automatically this long after it arrives, unless it
// needs review, so slow scoring can't stall prerequisite chains.
export const AUTO_ACCEPT_GRACE_SECONDS = 60;
// Outcome variance: the realized effect of a scored decision on Rt, CFR, and
// the social indices is the designed delta times a random factor in
// [1 - v, 1 + v]. Costs (fund, PPE, antivirals) are never varied, and the
// "what if every call were Optimal" shadow model stays deterministic.
export const OUTCOME_VARIANCE = 0.3;
// Phased feature unlock (class sessions): pledges and emergency funding open
// once this many distinct events have been fired, marketplace and trades
// after the second number. The facilitator can open everything early.
export const UNLOCK_PLEDGES_AFTER_EVENTS = 3;
export const UNLOCK_MARKET_AFTER_EVENTS = 5;
