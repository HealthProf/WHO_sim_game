<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Operation Veiled Horizon — Project Guide

A multi-tenant Next.js app that runs the *Operation Veiled Horizon* WHO
pandemic simulation: any visitor can create their own isolated game session
— six regional teams and one instructor responding to a scripted/adaptive
event queue in real time — with many sessions running concurrently. The
pedagogical design (scoring model, event content, scenario) lives in
`simulation-docs/` and is the source of truth for *what the simulation is* —
preserve it faithfully. Everything under `app/`, `lib/`, and `components/`
is *how it's built as software*, which is free to change as long as it
still serves that design.

## Stack

Next.js 16 (App Router, Turbopack) + Drizzle ORM + Postgres + NextAuth v5
(credentials provider, JWT sessions) + TanStack Query + Tailwind v4,
deployed on Vercel with Neon Postgres.

## Directory Map

- `app/(dashboard)/` — student-facing pages (one team per WHO region):
  situation room, events, coordination, pledges, marketplace, emergency
  funding, summary report.
- `app/(instructor)/` — facilitator-only pages: command center (`/control`),
  scoring inbox, debrief, action log, guide.
- `app/display/[token]/` — public, unauthenticated projector display.
- `app/api/` — route handlers; most business logic is delegated to `lib/`.
- `lib/` — the actual simulation engine and shared logic (see below).
- `lib/db/schema.ts` — Drizzle schema. `lib/db/seed-data/` — event content
  and region starting conditions (global, static, seeded once).
- `simulation-docs/` — pedagogical design docs (read `00-overview.md`
  first). Not application code, but the reference for intended behavior.

## Critical Constraints — read before touching money, time, sessions, or regions

- **Every game is a `game_sessions` row, and almost every other table is
  scoped to one via a `sessionId` column.** `regions`, `events`, and
  `eventChainLinks` are the only global/static tables — everything else
  (`teams`, `sessionState`, `modelState`, `decisions`, `scores`, and ~20
  more) belongs to exactly one session. **Any Drizzle query touching a
  per-session table must have `sessionId` in its `where` clause** — this is
  the isolation invariant that keeps concurrent sessions from bleeding into
  each other, and it's mechanically checkable by inspection. Session
  identity is resolved exactly once per request, in
  `lib/session-context.ts`'s `requireActor()`/`requireInstructorActor()`/
  `requireTeamActor()` — **no route may accept a `sessionId` from the
  client.** Any route that accepts another kind of client-supplied ID
  (a decision id, a dispatch id, a region code) must verify that row belongs
  to the actor's session before reading or mutating it, returning 404 (not
  403) on a miss.
- **Never use `db.transaction()`.** `lib/db/index.ts` switches drivers based
  on whether `DATABASE_URL` points at Neon: the `neon-http` driver used in
  production throws at runtime on `.transaction()` (it type-checks fine
  locally against `node-postgres`, then breaks in prod). All balance
  mutations (fund/PPE/antivirals) go through the atomic conditional-update
  helpers in `lib/db-atomic.ts` (`tryDeductRegionField`,
  `creditRegionField`, etc. — single-statement `UPDATE ... WHERE sessionId =
  $1 AND field >= amount RETURNING *`) instead. Multi-row money movement
  (e.g. a trade) debits first and compensates (deletes/reverts) on a later
  failure, rather than trying to be atomic across rows.
- **There is no real cron for fast-paced ticks.** Vercel's free Hobby plan
  only allows once-daily cron jobs, too coarse for a ~60-minute compressed
  session. `lib/deadline.ts`'s `processDeadlines(sessionId)` is instead
  called opportunistically from `/api/dashboard` and `/api/display` on every
  poll, throttled per-session by `sessionState.lastTickAt` +
  `TICK_THROTTLE_SECONDS` (see `lib/config.ts`) so concurrent pollers don't
  re-run it constantly and so sessions tick independently of each other.
  Passive drift, snap-vote expiry, budget-cycle timers, and social
  milestones all piggyback on this same tick — if you add a new "happens
  automatically while the sim is running" mechanic, hook it in here rather
  than adding a separate polling path.
- **`lib/regions.ts` is the single source of truth for the six region
  codes** (`REGIONS`/`RegionId`). Don't re-declare
  `["AFRO","AMRO","EMRO","EURO","SEARO","WPRO"]` inline — import it.
- **Logins are per-session, not fixed.** Public accounts are created through
  the app (no more fixed seeded credentials). An instructor session gets six
  generated per-region logins in `session_region_credentials` (username,
  bcrypt password hash, and a one-time plaintext hint for the credential
  sheet), created by `lib/session-lifecycle.ts`'s `createSession()`. There
  is no per-student account model — one login per region, shared by
  whichever students are staffing it that session.
- **`lib/model-engine/`** is split into `core.ts` (delta application +
  escalation state), `shadow.ts` (the "what if every call had been Optimal"
  counterfactual simulation), and `drift.ts` (passive time-based drift + the
  epidemic growth model). `lib/model-engine/index.ts` re-exports all three —
  import from `@/lib/model-engine` as a whole, don't reach into the
  submodules directly from outside the folder.
- **Tunable pacing constants live in `lib/config.ts`** (tick throttle,
  budget-cycle windows, announcement dismiss timers, leak chance, tempo-dial
  bounds, the political-tension cooperation lockout). Add new tunables there
  rather than as inline magic numbers — implementation-internal constants
  (e.g. the epidemic growth model's rate constants in `drift.ts`) stay local
  to their module instead, since moving them away from their explanatory
  comments would hurt more than it helps.

## Commands

```bash
npm run dev              # local dev server
npm run build             # production build (also type-checks)
npm run lint               # eslint
npm run test                # vitest — real local Postgres required, see below
npm run db:push            # push lib/db/schema.ts to DATABASE_URL (no migration files — this project doesn't use drizzle-kit generate/migrate)
npm run db:seed            # seed regions/events (global static content only — sessions/accounts are created through the UI)
npm run db:set-password -- <username> <new-password>
```

## Verifying changes

**Automated tests** (`npm test`, Vitest) live in `tests/` and run against
`TEST_DATABASE_URL` — a real local Postgres, never Neon (`tests/setup.ts`
fails loudly if it looks like a Neon URL). The logic here is overwhelmingly
DB-shaped, so mocking Drizzle would prove nothing; `tests/isolation.test.ts`
is the load-bearing suite — it asserts two concurrent sessions never observe
or affect each other's rows, ticks, or economies — and
`tests/concurrency.test.ts` covers the atomic-update guards under concurrent
load plus a grep-based regression guard that nothing calls
`db.transaction(`. `tests/helpers/db.ts`'s `resetDb()` truncates every
per-session table between tests; a newly added per-session table needs to be
added to its list or isolation tests won't cover it.

Beyond the automated suite, the pattern used throughout this codebase's
history for verifying a change actually works by hand: point `DATABASE_URL`
at a local Postgres, `npm run db:push && npm run db:seed`, start `npm run
dev`, register an account and create a session through the UI, then drive
the app with `curl` using a cookie jar per login (`/api/auth/csrf` → POST
`/api/auth/callback/credentials`) to exercise routes as each region and as
the instructor. **Run two sessions concurrently in every manual pass** and
confirm neither is visible in the other's data — that's the property the
whole data model exists to guarantee. For anything touching money movement,
test concurrent requests (`for i in 1 2 3; do curl ... & done; wait`)
against the atomic-update guards, not just the happy path. For UI changes,
use Playwright against `/opt/pw-browsers/chromium` with a fresh
`browser.newContext()` per login.
