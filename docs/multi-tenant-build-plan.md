# Build Plan — WHO Sim Public Version (Multi-Tenant + Scripted Demo Mode)

> **Audience:** a Claude Sonnet 5 session executing this in `HealthProf/WHO_sim_game`
> on branch `claude/who-sim-multi-tenant-plan-q4ubhn`.
> **Source spec:** Tim's "Build Spec — WHO Sim Public Version". This plan supersedes
> it wherever the two disagree, because this one was written with repo access.

---

## Context

`WHO_sim_game` today runs **exactly one game at a time**. A singleton `global_state`
row (`id = 1`) holds the clock, escalation state, WHO HQ treasury, and pacing dials;
seven fixed bcrypt-hashed logins in `lib/db/seed-data/credentials.ts` are the only
accounts; and `POST /api/instructor/reset` wipes the world to start over. That was
the right shape for its purpose — one instructor, one classroom, one compressed hour.

We are converting it into a **multi-tenant public deployment**: any visitor creates
an account and runs their own isolated session, either as an **instructor** with a
real class (per-session region credentials, orientation slides, projector display) or
in **demo mode** alone, hopping between roles while a **scripted autoplayer** drives
the regions they aren't occupying so the shared epidemic model actually moves.

**Multi-tenancy is the whole project.** Both modes sit on top of it. A half-migrated
data model — some queries session-scoped, some not — is worse than either end state
and produces cross-session bleed that is miserable to debug under real traffic. Phase
1 ships complete or it doesn't ship.

**Added beyond the source spec:** Phase 6 makes the app installable on a phone as a
PWA and fixes the mobile layout. Students arrive on phones and so will most demo-mode
visitors, and the whole thing fits inside the existing free tiers.

**Out of scope, deliberately:** invite-a-friend multiplayer (don't even leave hooks),
LLM-driven autoplay (interface only, scripted implementation), email delivery of any
kind, and push notifications (6a.6 — genuinely unbuildable on Hobby-tier cron, not
merely deferred).

---

## Phase 0 findings — already done, do not redo

The spec's §1 investigation is answered below from the actual code. Read this
section carefully; several of its findings contradict the spec's assumptions.

### 0.1 Table classification (24 tables in `lib/db/schema.ts`)

The single best source of truth for this classification already exists in the repo:
`app/api/instructor/reset/route.ts:45-127` enumerates every table the reset wipes or
restores. That list *is* the per-session mutable set.

**Global / static content — no `session_id`, read-only at runtime:**
`regions`, `events`, `event_chain_links`.
(Plus the non-table seed content: `lib/db/seed-data/{glossary,advisory-opinions,interjections}.ts`.)

**Per-session mutable state — every one of these gets `session_id NOT NULL`:**
`global_state` (→ renamed, see 0.2), `model_state`, `model_state_optimal`,
`model_state_history`, `event_dispatches`, `decisions`, `scores`,
`coordination_messages`, `instructor_actions`, `global_feed_items`,
`team_notifications`, `resource_pledges`, `snap_votes`, `snap_vote_responses`,
`announcements`, `announcement_acks`, `budget_cycles`, `budget_cycle_responses`,
`budget_cycle_donations`, `market_requests`, `region_trade_offers`,
`emergency_funding_requests`, `emergency_funding_contributions`,
`social_milestone_awards`.

**Ambiguous — the actual risk surface, resolved as follows:**

| Table | Why ambiguous | Resolution |
|---|---|---|
| `teams` | Looks static (six rows, one per region) but is FK'd by 15 mutable tables. `regionId` is `.unique()` (`schema.ts:89`) and `username` is `.unique()` (`schema.ts:91`) — both break the moment two sessions coexist. | **Becomes per-session.** Add `sessionId`; drop both unique constraints; add `uniqueIndex(sessionId, regionId)`; move `username` out to `session_region_credentials`. Because 15 tables FK to `teams`, this alone carries most of the isolation — but we still add explicit `session_id` to those tables (see 1.3 for why). |
| `users` | Currently holds *both* the seven fixed game logins and (after Phase 2) public accounts. | **Stays global, becomes public accounts only.** Region logins move to the new `session_region_credentials` table per spec §4.1. |
| `social_milestone_awards` | Uses a bare `regionId` text column with the sentinel `"GLOBAL"` and a unique index on `(regionId, metric, tier)` (`schema.ts:619-629`). | Per-session. Unique index becomes `(sessionId, regionId, metric, tier)`. |
| `announcements.targetTeamIds` | A `jsonb` array of raw team IDs, not an FK. | Per-session; team IDs inside it are meaningless across sessions but harmless once the row itself is session-scoped. |

### 0.2 `global_state` — the singleton

Defined at `schema.ts:105-167`, always addressed as `eq(globalState.id, 1)`.
**74 references across 22 files** (`app/api/*`, `lib/{deadline,budget-cycle,economy,
social-thresholds,db-atomic}.ts`, `lib/model-engine/{core,drift}.ts`, several client
components, `scripts/seed.ts`).

It carries far more than the spec's README-derived guess. Full shape: `currentDay`,
`escalationState`, `mediaPressureIndex`, `simulationStatus`, `fastModeMultiplier`,
`respectBlackoutWindow`, `simulationStartedAt`, `pausedAccumulatedMs`, `pausedAt`,
`gameDaysPerRealMinute`, `totalGameDays`, `lastDriftAppliedAt`, `lastTickAt`,
`whoHqFund`, `whoHqPpeStock`, `whoHqAntiviralsStock`,
`lastBudgetCycleNarrativeDay`, `intensityMultiplier`, `updatedAt`.

**Correction to spec §2.1.** The spec says these fields "move onto `game_sessions`".
Don't. Split instead:

- `game_sessions` — identity and lifecycle: `id`, `ownerUserId`, `mode`, `status`,
  `displayToken`, `createdAt`, `startedAt`, `completedAt`, `lastActivityAt`,
  demo-mode fields. Small, rarely written, and it's the row the reaper and the
  concurrency caps scan.
- `session_state` — structurally *identical* to today's `global_state`, with
  `sessionId` as PK/FK replacing `id`. Wide, hot, rewritten on every tick.

This is not gold-plating: it makes the diff at all 74 call sites a mechanical
`eq(globalState.id, 1)` → `eq(sessionState.sessionId, sessionId)`, with every
`gs.fastModeMultiplier`-style field access untouched. Merging the two tables would
force a wider rewrite for no benefit and would put a hot 19-column write on the same
row the reaper scans.

### 0.3 The tick path

`processDeadlines()` lives at `lib/deadline.ts:44-181`. It is called from:

- `app/api/dashboard/route.ts:28` — every team dashboard poll (~15s)
- `app/api/display/route.ts:28` — the projector poll (most reliable source; the
  projector stays open all session)
- `app/api/cron/deadlines/route.ts` — Vercel cron, daily only (Hobby plan limit)

The throttle is a single atomic conditional UPDATE at `deadline.ts:50-58`: claim
`lastTickAt` if it is null or older than `TICK_THROTTLE_SECONDS` (3s,
`lib/config.ts:13`); losers return a no-op. Piggybacking on the same tick
(`deadline.ts:60-63`): `applyPassiveDrift`, `closeExpiredSnapVotes`,
`processBudgetCycleTimers`, `checkSocialMilestones` — then deadline reminders and
the no-response auto-fallback scoring loop.

This becomes `processDeadlines(sessionId)` and the claim targets that session's row,
so sessions tick independently. **This is the single most likely place for a subtle
bug** — see 1.6.

### 0.4 Tiered response options — YES, they exist (spec §1.4)

**This is the finding that makes Phase 4 cheap.** `lib/db/seed-data/events.ts`
defines:

```ts
export interface StructuredOption {
  label: string;            // "A" | "B" | "C" | "D"
  text: string;
  suggestedTier: Tier;      // OPTIMAL | ADEQUATE | INADEQUATE | CRITICAL_FAILURE
  cost?: OptionCost;        // { fund?, ppeDays?, antivirals? }
  impactDesc: string;
}
```

**21 of the 25 events** carry a full `structuredOptionsJson` array (84 options
total), each with an explicit `suggestedTier`. Separately, every event carries
`modelDeltaJson: Record<Tier, ModelDelta[]>` — the per-tier model effects. The
autoplayer's decision table is therefore **already authored**: sample a `label` from
the tier distribution a competence profile implies, and submit it.

**Four events have `structuredOptionsJson: null`** and need a fallback:

| Event | Title | Shape |
|---|---|---|
| EVT-006 | Early-Access Vaccine Allocation ("The Equity Crucible") | `isAllocationEvent: true` — free-text + a dose split that must sum to exactly 180,000 (`app/api/decisions/route.ts:88`) |
| EVT-012 | Second Vaccine Tranche (Revised Allocation) | same |
| EVT-014 | Outbreak Trajectory Briefing | rationale text only |
| EVT-016 | After-Action Report Initiation | rationale text only |

**Decision (assumption, flag it to Tim at the Phase 4 checkpoint):** ship
*placeholder* autoplayer behavior for these four rather than skipping them —
EVT-006 is the scenario's pedagogical centerpiece and a demo without it undersells
the whole thing. Population-weighted dose split (mechanically valid, sums to
180,000) plus a short generic rationale, all in one clearly-marked
`AUTOPLAYER_PLACEHOLDER_COPY` block in `lib/autoplayer/scripted.ts` with a TODO for
Tim. **Do not invent content beyond those four TODO strings.**

### 0.5 The shadow "Optimal" simulation

`lib/model-engine/shadow.ts:27` — `applyOptimalShadowDelta(deltas, submittingRegionId)`.
It does *not* compute an optimal path; it is handed `modelDeltaJson.OPTIMAL` by the
caller and mirrors it onto `model_state_optimal` regardless of what tier actually
happened. Only four fields exist on the shadow table (`rt`, `cfrMultiplier`,
`publicTrustIndex`, `populationHappinessIndex`); resource-economy deltas are dropped
(`shadow.ts:15`). Called from two places: `lib/deadline.ts:152` (auto-fallback) and
the scoring route. Needs `sessionId` threaded and nothing more.

### 0.6 Auth

`lib/auth.ts` — NextAuth v5, **one** Credentials provider, JWT strategy. `authorize`
looks up `users` by lowercased username (`auth.ts:35`), verifies with
`bcrypt.compare` (`auth.ts:38`), then resolves `regionId` via the user's `teamId`.
The `jwt`/`session` callbacks (`auth.ts:58-77`) carry `id`, `username`, `role`
(`"student" | "instructor"`), `teamId`, `regionId`.

**Password hashing is already bcrypt (cost 10)** — `scripts/seed.ts:55`. Spec §3.1's
[VERIFY] resolves clean; nothing to fix.

`middleware.ts` gates by `req.auth.user.role` alone: instructor-only prefixes
(`/control`, `/scoring`, `/debrief`, `/log`, `/guide`) and team-only prefixes. Routes
use `requireSession()` / `requireInstructor()` from `lib/api-helpers.ts` (18 lines).

Phase 3 adds a third dimension — *which game session* — and Phase 4 adds a fourth:
in demo mode the effective role changes without re-authenticating, so it **cannot**
live in the JWT. See 3.2 and 4.6.

### 0.7 The display route is not token-protected at all

**Correction to spec §4.4.** `app/api/display/route.ts` takes **no token parameter
and performs no token check** — `export async function GET()` with zero arguments.
The token in `/display/[token]` is decorative; the page fetches `/api/display`,
which returns the one global game. `middleware.ts:23` explicitly lets `/api/display`
through unauthenticated.

So this isn't "re-audit an existing token" — it's **build the token check that was
never there**. The route's public-safe field discipline (`display/route.ts:15-22`)
is real and correct and must be preserved verbatim; what's missing is the lookup.

### 0.8 Neon / transactions

Confirmed and non-negotiable. `lib/db/index.ts:20-22` switches on
`/neon\.tech/.test(DATABASE_URL)`; the `neon-http` driver throws *at runtime* on
`.transaction()` while type-checking fine against local `node-postgres`.
`lib/db-atomic.ts` documents the pattern in full at lines 1-26. **Never introduce
`db.transaction()` anywhere in this project.**

### 0.9 No test suite exists

`package.json` has no test script and no runner. AGENTS.md documents the manual
convention: local Postgres, `db:push && db:seed`, `npm run dev`, drive with `curl`
and a cookie jar per login. That is not sufficient for a refactor of this size.

**Decision (assumption):** add **Vitest** + integration tests against a real local
Postgres. The logic is almost entirely DB-shaped, so mocking the DB would prove
nothing; the tests must hit real Postgres. See §6.

---

## Phase 1 — Multi-tenancy

**Nothing else starts until this is done and the isolation suite is green.**

### 1.1 New tables

In `lib/db/schema.ts`:

```ts
export const sessionModeEnum = pgEnum("session_mode", ["instructor", "demo"]);
export const sessionStatusEnum = pgEnum("session_status",
  ["setup", "running", "paused", "completed", "archived"]);

export const gameSessions = pgTable("game_sessions", {
  id: text("id").primaryKey(),                    // nanoid-style, see 1.2
  ownerUserId: integer("owner_user_id").notNull().references(() => users.id),
  mode: sessionModeEnum("mode").notNull(),
  status: sessionStatusEnum("status").notNull().default("setup"),
  displayToken: text("display_token").notNull().unique(),  // unguessable, NOT the pk
  createdAt / startedAt / completedAt / lastActivityAt: timestamp,
  // demo mode only — see 4.6
  demoActiveRegionId: text("demo_active_region_id"),  // null = user is the instructor
});

export const sessionRegionCredentials = pgTable("session_region_credentials", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().references(() => gameSessions.id),
  regionId: text("region_id").notNull().references(() => regions.id),
  username: text("username").notNull().unique(),   // e.g. "afro-7f3k9q" — globally unique
  passwordHash: text("password_hash").notNull(),
  plaintextHint: text("plaintext_hint"),           // shown once on the credential sheet, see 3.1
}, (t) => [uniqueIndex("session_region_credentials_uniq").on(t.sessionId, t.regionId)]);
```

Rename `globalState` → `sessionState` (table `session_state`), replacing
`id: integer().default(1)` with `sessionId: text().primaryKey().references(gameSessions.id)`.
**Every other column stays byte-identical**, including all the explanatory comments —
they are still accurate, just per-session now.

### 1.2 ID generation

No id library is installed. Don't add one: use `crypto.randomUUID()` from `node:crypto`
for `gameSessions.id`, and `crypto.randomBytes(24).toString("base64url")` for
`displayToken` and generated passwords. Put both in a new `lib/ids.ts`.

### 1.3 Threading `session_id`

Add `sessionId: text("session_id").notNull().references(() => gameSessions.id)` to
all 24 per-session tables listed in 0.1, each with an index. Rewrite unique indexes
to include `sessionId` (`snap_vote_responses`, `announcement_acks`,
`budget_cycle_responses`, `budget_cycle_donations`,
`emergency_funding_contributions`, `social_milestone_awards`, plus the new
`teams` and `model_state`/`model_state_optimal` region uniqueness).

*Why add `session_id` to tables that already FK to `teams`?* Because it makes every
query's session filter local and greppable. The isolation invariant becomes checkable
by inspection: **any Drizzle query touching a per-session table must have `sessionId`
in its `where`.** With only transitive scoping via `teams` you'd have to reason about
joins to know whether a query is safe.

### 1.4 The `teams` refactor and actor columns

`teams` gains `sessionId`, loses `unique()` on `regionId` and loses `username`
entirely (moves to `session_region_credentials`).

Six columns currently FK to `users.id` as "who did this". After Phase 2 a region
login is no longer a `users` row, so:

- **Instructor-side actors stay `users.id` FKs** — always the session owner:
  `scores.scoredByUserId`, `instructor_actions.instructorUserId`,
  `event_dispatches.dispatchedByUserId`, `snap_votes.createdByUserId`,
  `market_requests.resolvedByUserId`.
- **Team-side actors** — `decisions.submittedByUserId`,
  `resource_pledges.createdByUserId` — become **nullable**, and each table gains
  `actorKind: text` (`"team" | "owner" | "autoplayer" | "system"`). `teamId` already
  identifies *which* region acted; `actorKind` records *what kind of thing* acted.
  This also fixes an existing latent bug: `lib/deadline.ts:94` finds the system user
  via `eq(users.role, "instructor")`, which returns an arbitrary instructor once
  multiple public accounts exist.

### 1.5 Session context resolution

New `lib/session-context.ts`, replacing the two helpers in `lib/api-helpers.ts` at
every call site:

```ts
export interface Actor {
  sessionId: string;
  role: "instructor" | "student";
  teamId: number | null;
  regionId: string | null;
  userId: number | null;      // null for a session-region login
  isOwner: boolean;
}
export async function requireActor(): Promise<{ actor: Actor|null; error: NextResponse|null }>
export async function requireInstructorActor(): Promise<...>  // role === "instructor"
export async function requireTeamActor(): Promise<...>        // role === "student", teamId set
```

`requireActor()` reads the JWT, resolves the session, and — **for demo sessions
only** — overrides `role`/`teamId`/`regionId` from `gameSessions.demoActiveRegionId`
(4.6). It also bumps `lastActivityAt` (5.2). This is the one place session identity
is decided; **no route may accept a `sessionId` from the client.**

### 1.6 `processDeadlines(sessionId)`

`lib/deadline.ts:44` takes a `sessionId`. The throttle claim (`deadline.ts:50-58`)
targets `sessionState.sessionId`, so concurrent sessions tick independently. Same for
`computeDeadlineAt(sessionId, eventId, dispatchedAt)`.

The four piggybacked subsystems all take `sessionId` too: `applyPassiveDrift`,
`closeExpiredSnapVotes`, `processBudgetCycleTimers`, `checkSocialMilestones`. The
`systemUser` lookup at `deadline.ts:94` is deleted — the auto-fallback decision gets
`submittedByUserId: null, actorKind: "system"` instead.

**The cron route (`app/api/cron/deadlines/route.ts`) must now loop** over sessions in
`status = 'running'` (bounded — skip ones idle past the reap threshold, see 5.2).

### 1.7 The mechanical sweep

~40 exported functions in `lib/` take `sessionId` as their first parameter. Full list
is derivable from `grep -nE '^export (async )?function' lib/*.ts lib/model-engine/*.ts`.
The high-traffic ones: `lib/db-atomic.ts` (all four), `lib/model-engine/core.ts`
(`applyModelDelta`, `applyFieldDelta`, `recomputeEscalationState`, `computeGlobalRt`),
`lib/model-engine/drift.ts` (`applyPassiveDrift`), `lib/model-engine/shadow.ts`,
`lib/announcements.ts` (6), `lib/budget-cycle.ts` (7), `lib/snap-vote.ts` (5),
`lib/summary-report.ts`, `lib/final-results.ts`, `lib/team-chapter.ts`,
`lib/consequences.ts`, `lib/stakeholders.ts`, `lib/chain.ts`, `lib/event-targeting.ts`,
`lib/social-thresholds.ts`, `lib/economy.ts`.

**Do this by letting TypeScript drive it.** Change the schema and the helper
signatures first, then run `npx tsc --noEmit` and fix every error. `npm run build`
type-checks, so a clean build is the completion signal for the sweep. Resist the urge
to "fix" an error by casting or by reaching for a default session.

### 1.8 Session creation without transactions

Per spec §2.4 and the `db-atomic.ts` convention — **fail toward destroying value, not
toward a broken-but-live session.** New `lib/session-lifecycle.ts`:

```
createSession(ownerUserId, mode):
  1. INSERT game_sessions (status = 'setup')          // live but not joinable
  2. INSERT session_state (sessionId, seeded defaults)
  3. INSERT 6 teams
  4. INSERT 6 model_state + 6 model_state_optimal  (from regions.starting* columns —
     copy the shape from scripts/seed.ts:68-106, which already derives these)
  5. INSERT 6 session_region_credentials            // instructor mode only
  6. UPDATE game_sessions SET status = 'running'    // the commit point
```

A crash anywhere in 1-5 leaves a `'setup'` session with missing children, which the
reaper (5.2) deletes. Nothing ever observes a live session with missing regions,
because every read path filters on `status != 'setup'`.

`deleteSession(sessionId)` deletes children before parents — copy the exact ordering
from `app/api/instructor/reset/route.ts:45-65`, which already encodes the FK
dependency order, then `teams`, `session_region_credentials`, `session_state`,
`game_sessions`.

### 1.9 Rework `db:seed` and the reset route

- `scripts/seed.ts`: keep regions + events + chain links. **Delete** the teams /
  users / model_state / global_state / credentials blocks (lines 35-134) — those are
  now per-session. Keep printing something useful: a note that accounts are created
  through the UI. Delete `lib/db/seed-data/credentials.ts`.
- `app/api/instructor/reset/route.ts`: becomes "reset *my* session" — same delete
  ordering, every statement gaining `WHERE session_id = $1`, restoring that session's
  `session_state` and `model_state` rather than the singleton.

### 1.10 Ownership-check audit (spec §2.3)

Fourteen routes accept an ID from the client body/query. Each needs an explicit
"does this belong to my session?" check. Confirmed list, with what's checked today:

| Route | Client-supplied ID | Today |
|---|---|---|
| `api/decisions` POST:71 | `eventDispatchId` | checks `dispatch.targetTeamId === user.teamId` ✅ |
| `api/decisions` GET:146 | `eventDispatchId` | **no check at all — returns every decision for any dispatch** |
| `api/announcements`:16 | `announcementId` | needs check |
| `api/budget-cycle`:67 | `cycleId` | needs check |
| `api/coordination`:44,61 | `toRegionId`, `eventDispatchId` | needs check |
| `api/emergency-funding`:100 | `requestId` | needs check |
| `api/events` POST:46-48, 112 | `eventId`, `targetTeamId`, `targetRegionIds`, `dispatchId` | `targetTeamId` must be verified in-session |
| `api/instructor/budget-cycle`:39 | `cycleId` | needs check |
| `api/instructor/emergency-funding`:47 | `requestId` | needs check |
| `api/instructor/interjection`:17-18 | `interjectionId`, `targetRegionId` | needs check |
| `api/instructor/market`:36 | `requestId` | needs check |
| `api/instructor/snap-vote`:43 | `snapVoteId` | needs check |
| `api/pledges`:51,100 | `toRegionId`, `eventDispatchId` | needs check |
| `api/scores`:92 + `api/scores/bulk-accept`:13 | `decisionId`, `decisionIds[]` | needs check |
| `api/snap-vote`:33 | `snapVoteId` | needs check |
| `api/trade`:35,83 | `toRegionId`, `offerId` | needs check |

The `api/decisions` GET leak is pre-existing and intra-session it's arguably by
design (decisions become public when revealed), but post-refactor it is a
**cross-session data leak** and must be closed.

The mechanical fix: every fetch-by-client-id becomes
`and(eq(table.id, id), eq(table.sessionId, actor.sessionId))`, returning 404 (not
403 — don't confirm existence) when it misses. Region-code parameters
(`toRegionId`, `targetRegionIds`) resolve to a `teams` row **within the actor's
session**.

### 1.11 Checkpoint 1 — stop and report

- `npm run build` clean.
- Isolation suite (§6.2) green.
- The ownership table above, re-reported with every row marked done.
- A grep-based sweep report: any `db.query.<perSessionTable>` or
  `db.update/delete(<perSessionTable>)` call site with no `sessionId` in its `where`,
  listed with a justification or a fix.

---

## Phase 2 — Public accounts

Minimal by design. This is a demo with enough identity to keep sessions apart.

### 2.1 Schema

`users` gains: `email text` (nullable), `institution text` (nullable),
`displayUsername text` (what they typed; `username` stays the lowercased unique key),
`createdAt`, `lastLoginAt`. `role` keeps its existing enum but every public account is
`"student"`-valued at the table level — **role is now a property of the session
membership, not the account.** Add a `isPublicAccount boolean` if it helps readability.

### 2.2 Registration — `app/(public)/register/page.tsx` + `POST /api/account/register`

- **User chooses their own username.** Reject any string containing `@`. Reject the
  seven reserved names (`instructor`, `afro`, `amro`, `emro`, `euro`, `searo`,
  `wpro`) and near-misses (strip non-alphanumerics and compare lowercased).
  Normalize case for uniqueness; store the typed form in `displayUsername`.
- **Generate a strong password by default**, shown once in a copy-to-clipboard field
  with an unmissable "there is no recovery without an email" warning. Offer a "set my
  own instead" toggle. Generate via `crypto.randomBytes` in `lib/ids.ts`; hash with
  `bcrypt.hash(pw, 10)` — matching `scripts/seed.ts:55`.
- Validate the request body with `zod` (already a dependency).

### 2.3 Optional profile — `app/(public)/account/page.tsx`

Name, email, institution/location. Clearly optional, with purpose text stating
plainly: used only to contact them about updates to the simulation, and **an email is
the only way to recover the account.**

> **[AUTHOR ACTION — not a code task]** Tim: confirm NAU's position on collecting
> name/email/institution from the public via a university-affiliated tool before this
> ships. Almost certainly fine as a non-research contact list — but a five-minute
> email to data governance is cheaper than finding out later.

### 2.4 Recovery — build the model, not the mechanism

No email is sent in this project, at all. `/account/recover` renders "contact the
maintainer" with a `mailto:`. Do **not** add an email service to unblock this.

### 2.5 Rate limiting

`POST /api/account/register` and the credentials sign-in path need per-IP throttling.
Use a small **DB-backed counter table** (`rate_limit_counters(key, windowStartedAt,
count)`, key = `ip:route`), not an in-memory limiter — on Vercel each lambda instance
gets its own memory, so in-memory is close to decorative. Single atomic upsert per
check, consistent with `db-atomic.ts`. Note the tradeoff (one extra write per auth
attempt) in a code comment.

### 2.6 Auth changes — one provider, two credential stores

Extend the **existing** Credentials provider in `lib/auth.ts` rather than adding a
second (spec §4.2: "prefer whichever is less clever"). `authorize` resolves in order:

1. `users` by lowercased username → public account. Token: `{ userId, kind: "user" }`.
2. `session_region_credentials` by username → region login. Token:
   `{ credentialId, sessionId, regionId, teamId, kind: "region" }`.

Because generated region usernames carry a random suffix (`afro-7f3k9q`), the two
namespaces cannot collide; enforce it anyway by rejecting `-`-suffixed patterns at
registration.

The JWT no longer carries `role`. `middleware.ts` can only do coarse
logged-in/logged-out gating plus public-route allowlisting; **fine-grained role
gating moves server-side into `requireActor()`** (1.5), because in demo mode role
changes without a new token. Update `middleware.ts:31-39` accordingly and re-verify
each instructor-only page guards itself.

### 2.7 Checkpoint 2 — stop and report

End to end, by hand: register → log in → create a session → log out → log back in →
land back in that session.

---

## Phase 3 — Instructor Mode

Cheaper than demo mode, and it proves the session infrastructure under real load.

### 3.1 Creation flow — `app/(public)/sessions/page.tsx` + `POST /api/sessions`

"Run a session with my class" → `createSession(ownerUserId, "instructor")` (1.8) →
six generated region credentials → a **printable/copyable credential sheet**
(`app/(public)/sessions/[id]/credentials/page.tsx`) with a print stylesheet.

Passwords are shown **once at creation** and stored only as bcrypt hashes.
`plaintextHint` exists so the sheet can be re-rendered during the session; make the
retention explicit in a code comment and clear it when the session completes. If Tim
prefers no plaintext at rest, the alternative is a "regenerate this region's
password" button — implement the hint field now, note the alternative.

### 3.2 Region login

Students enter the generated username/password at the normal `/login`. `authorize`
resolves it via `session_region_credentials` (2.6) and the token carries the
`sessionId`, so they land directly in that session's dashboard. No session picker,
no join code — the credential *is* the session binding.

### 3.3 Orientation slides — container only

**This is content work, not engineering.** Build a JSON-driven slide sequence:
`lib/db/seed-data/orientation-slides.ts` exporting
`{ id, audience: "projector" | "instructor", title, bodyMarkdown }[]`, rendered by a
generic `components/slide-deck.tsx` with keyboard nav. Wire two routes: a
projector-facing deck and an instructor-facing pre-session checklist. There is an
existing `app/(dashboard)/orientation/page.tsx` — extend rather than duplicate.

Cover (as **clearly-marked placeholder copy**): what the simulation is and how a
session runs; the 40/30/30 rubric and why it isn't correct/incorrect; that regions
are asymmetric on purpose and coordination is the point; and instructor-side —
pre-session checklist, credential handout, dispatching events, the tempo dial,
running the debrief. **Do not write final pedagogical copy. That's Tim's.**

### 3.4 Projector display — build the token check that was never there

Per 0.7 this is new work. `/display/[token]` passes its token to
`GET /api/display?token=...`; the route resolves `gameSessions.displayToken` →
`sessionId` and 404s on a miss. The token is `crypto.randomBytes(24).toString("base64url")`
— **never the session's primary key**.

Re-audit the public-safe field discipline documented at `display/route.ts:15-22`
against the new session-scoped queries: while a game is active the response must
still never expose decisions, `resourceAllocationJson`, or team-private `model_state`
fields (fund / PPE / antivirals / HCW surge / political tension / public trust).
The aggregate-only computations at `display/route.ts:56-60` are the pattern to keep.

### 3.5 Checkpoint 3 — stop and report

A full session runs end to end with session-scoped region credentials and a
session-scoped projector display, with a second concurrent session running in
parallel and provably invisible in the first one's data.

---

## Phase 4 — Demo Mode (scripted autoplayer)

Gated behind Phase 3 working. This is what a curious visitor from LinkedIn actually
clicks, so it has to be reliable on first click.

### 4.1 What it is

One user, alone, in their own session, free to occupy any role — instructor or any of
the six regional directors — and switch at will. Every region they aren't currently
driving is played by the scripted autoplayer, so the shared model moves and the
compounding-consequence mechanic demonstrates itself.

Demo sessions run on a faster clock. **`fastModeMultiplier` semantics
(`schema.ts:111`): real minutes per stated event-deadline hour**, default `1/60` (one
real minute per narrative hour). It governs *deadline windows only*. The narrative-day
clock is separate: `gameDaysPerRealMinute` (default 1.5) × `totalGameDays` (90) =
60 real minutes. For a 10-15 minute demo arc set `gameDaysPerRealMinute: 6` and
`fastModeMultiplier: 1/240` at demo-session creation. Put both in `lib/config.ts` as
`DEMO_GAME_DAYS_PER_REAL_MINUTE` / `DEMO_FAST_MODE_MULTIPLIER` and **tune them by
actually running a demo**, not by arithmetic alone.

### 4.2 The interface (spec §5.5)

`lib/autoplayer/index.ts`:

```ts
export interface AutoplayerDecision {
  optionLabel: string | null;                         // null for the 4 free-text events
  rationaleText: string;
  resourceAllocationJson?: Record<string, number>;
  confidenceLevel: "LOW" | "MEDIUM" | "HIGH" | null;
  rationale: string;                                  // why this was picked (debug/debrief)
}
export interface AutoplayerBackend {
  decideForRegion(ctx: {
    sessionId: string; regionId: RegionId;
    event: typeof events.$inferSelect;
    modelState: typeof modelState.$inferSelect;
    profile: CompetenceProfile;
  }): Promise<AutoplayerDecision>;
}
```

`lib/autoplayer/scripted.ts` implements it. **Build the interface; build only the
scripted implementation.** No LLM call anywhere: it would put a paid API on the
critical path of a free-tier deployment, add latency inside a time-pressured session,
create a cost surface that scales with exactly the popularity we want, and inject
nondeterminism into the one thing that must be reliable for a stranger.

### 4.3 Competence profiles

New table `session_region_autoplay(sessionId, regionId, profile, enabled)`.
Profiles and their tier sampling distributions (put these in `lib/config.ts`):

| Profile | OPTIMAL | ADEQUATE | INADEQUATE | CRITICAL_FAILURE |
|---|---|---|---|---|
| `strong` | 0.60 | 0.30 | 0.10 | 0.00 |
| `mixed` | 0.25 | 0.45 | 0.25 | 0.05 |
| `struggling` | 0.05 | 0.30 | 0.45 | 0.20 |

Sample a target tier, then pick uniformly among that event's options whose
`suggestedTier` matches; fall back to the nearest available tier when an event has no
option at the sampled tier (common — most events have 4 options across ~3 tiers).
Assign profiles with variety at session creation (shuffle, e.g. 2 strong / 2 mixed /
2 struggling) so no two demo runs feel identical.

Affordability: options carry `cost` and the submit path rejects unaffordable choices
(`api/decisions/route.ts:117-120`). The autoplayer must **filter to affordable
options before sampling**, and if none are affordable pick the cheapest — a broke
region making bad cheap choices is exactly the intended texture.

### 4.4 The design rule — one submission path

**The autoplayer submits through the same code path a human does.** It is not a
parallel simulation.

Today that path is inline in the route handler (`app/api/decisions/route.ts:63-139`),
including `applyOptionCost` / `refundOptionCost`. **Extract it first**, before writing
any autoplayer code, into `lib/decisions.ts`:

```ts
export async function submitDecision(opts: {
  sessionId: string; teamId: number; eventDispatchId: number;
  structuredChoice: string | null; rationaleText: string;
  resourceAllocationJson?: unknown; coordinatedWithTeamsJson?: unknown;
  confidenceLevel: ConfidenceLevel | null;
  actor: { kind: "team"|"owner"|"autoplayer"|"system"; userId: number | null };
}): Promise<{ decision: Decision } | { error: string }>
```

`POST /api/decisions` becomes a thin auth + validation wrapper over it. **This
extraction is a pure refactor — verify the human path still works before adding the
autoplayer on top of it.**

### 4.5 Scoring for autoplayed decisions

Human decisions are scored by the instructor via the scoring inbox. In demo mode
there is no instructor for the five AI regions, so autoplayed decisions are
**auto-scored on the existing fast path**: `defaultScoresForTier(suggestedTier)`
(`lib/scoring.ts:46`) → `computeCompositePct` → insert `scores` with
`fastPathed: true`. This is exactly what `lib/deadline.ts:124-141` already does for
no-response fallbacks — reuse that code, don't re-derive it. Then apply
`applyModelDelta` + `applyOptimalShadowDelta` + `pushConsequence` +
`announceDecisionRevealed` in the same order as `deadline.ts:143-176`.

**The user's own decisions in demo mode are also auto-scored** (there's nobody else
to do it), with the scoring screen still reachable so they can see the rubric applied.

### 4.6 Role switching without re-authenticating

`gameSessions.demoActiveRegionId` is the server-side source of truth.
`POST /api/sessions/[id]/role` sets it (owner-only, demo-mode-only, single atomic
UPDATE). `requireActor()` (1.5) reads it and synthesizes the effective actor.
`null` = the user is the instructor.

The autoplayer skips whichever region is currently occupied (`demoActiveRegionId`),
and resumes it when the user leaves.

**The known risk (spec §5.6 [VERIFY]):** 15 of the 20 pages are `"use client"` and
consume `session.user.role`/`regionId` from the NextAuth client session, which is JWT-
derived and therefore stale after a role switch. Fix: `/api/dashboard` already returns
everything the dashboard renders — **add the resolved actor to its response payload**
and have demo-mode pages read role/region from that rather than from the token. Audit
every `useSession()` / `session.user.role` reference during Phase 4 and route it
through the same payload. The simplest correct fallback if a component resists: force
a client-side router refresh after a role switch.

### 4.7 Behavioral texture — keep it cheap

- Randomized response delay inside the event's deadline window (store a
  `respondAfter` timestamp on the autoplay row at dispatch; the tick fires it).
- `struggling` profiles occasionally miss deadlines entirely, so hard-deadline
  consequences visibly fire (the existing auto-fallback at `deadline.ts:104-178`
  handles this for free — just don't respond).
- Varied profile assignment per session (4.3).

**Resist building more.** Convincing agent behavior is not the goal of a scripted demo.

### 4.8 Where the autoplayer runs

Hook it into `processDeadlines(sessionId)` (0.3) — it is already the "things that
happen automatically while the sim is running" tick, and AGENTS.md is explicit that
new automatic mechanics belong there rather than in a new polling path. Add
`runAutoplayer(sessionId)` alongside the four existing subsystem calls at
`deadline.ts:60-63`.

Demo sessions also need **automatic event dispatch** — there's no instructor
clicking "dispatch". Add a scripted queue: dispatch the next `isCorePath` event
whenever the narrative-day clock passes its `events.day`, respecting
`lib/chain.ts`'s `canDispatch()` prerequisites. Same tick.

### 4.9 Guided framing (spec §5.7)

Short in-context explainers: what the user is looking at, what 40/30/30 means, and
what the shadow simulation is showing in the debrief. Reuse the slide-deck component
from 3.3 with a `demo` audience, plus dismissible inline callouts on the dashboard
and debrief. A visitor with no global-health background should understand *why the
design is interesting* within two minutes — that, not the gameplay, is the takeaway.

### 4.10 Checkpoint 4 — stop and report

A solo user completes a demo run in 10-15 minutes; the model visibly moves from
autoplayer decisions; the debrief and shadow sim render. Report the four
placeholder-copy events (0.4) for Tim to review.

---

## Phase 5 — Scaling hygiene

Build it in rather than retrofitting. The bottleneck is **Neon, not Vercel**: free-tier
compute hours and connection ceilings, and the architecture drives *writes* with poll
volume — every dashboard poll can trigger `processDeadlines()`, so concurrent sessions
multiply writes, not just reads.

### 5.1 Session-level tick gating

`processDeadlines(sessionId)` returns early when `status !== 'running'` (it already
does the equivalent for `simulationStatus`, `deadline.ts:46`) **or** when
`lastActivityAt` is older than `IDLE_TICK_CUTOFF_MINUTES` (start at 30). Polls still
return current state; they just stop doing work.

### 5.2 Reaping

- Idle > 30 min → stops ticking (5.1).
- Idle > 24 h → `status = 'archived'`.
- Archived **demo** sessions are deletable (`deleteSession`, 1.8). Archived
  **instructor** sessions are retained far longer — an instructor may want the
  debrief data. Put both windows in `lib/config.ts`.
- Implement **opportunistically** (a `reapStale()` call inside the tick, itself
  throttled by a `lastReapAt` marker) plus the existing daily Vercel cron. **No new
  always-on service.**

### 5.3 Poll backoff

Add `stateVersion: integer` to `session_state`, incremented on every mutating write
(single atomic `SET state_version = state_version + 1`). `/api/dashboard` and
`/api/display` accept `?since=<version>`; when unchanged, return
`{ unchanged: true, nextPollMs }` with a backing-off interval (15s → 30s → 60s while
idle, reset on any change). Update `lib/fetcher.ts` and the TanStack Query hooks to
honor `nextPollMs`. Idle demo sessions should cost close to nothing.

### 5.4 Caps

- Per user: **1 active demo + 1 active instructor** session. Creating another either
  reuses or archives the old one — ask, don't silently destroy.
- Global: `MAX_CONCURRENT_ACTIVE_SESSIONS` in `lib/config.ts`, enforced at creation
  with a graceful "the demo is busy, try again shortly" page. This is the difference
  between degrading and falling over with a Neon connection error.

### 5.5 Minimal observability

New `session_events(sessionId, kind, mode, detail, createdAt)` — log creation,
completion, archival, and reaping. `"47 instructors ran a session"` is a far better
thing to be able to say than `"it's deployed"`, and it's what tells Tim how far people
actually get.

### 5.6 Checkpoint 5 — stop and report

Reaping, backoff, and caps verified under simulated multi-session load (§6.5).

---

## Phase 6 — Mobile layout and PWA install

Students arrive on phones; a LinkedIn visitor clicking into demo mode almost
certainly does. **Everything in this phase is free** — Next 16 generates the manifest
natively, the service worker is a static asset on Vercel's CDN, and Vercel already
serves HTTPS. No new compute, no new DB rows, no new dependency.

### 6a.1 What a PWA actually buys this app

**Installability and full-screen chrome. Not offline.** Every screen is live-polled
DB state (`/api/dashboard` every ~15s, `/api/display` continuously). Caching API
responses would show students a stale epidemic and a frozen clock — strictly worse
than a spinner. Pitch it as "add it to your home screen and it opens like an app",
never as "works offline."

### 6a.2 Do this early, not in Phase 6

Two items shouldn't wait:

1. **Fix `app/layout.tsx`'s metadata.** It still ships create-next-app's defaults —
   `title: "Create Next App"`, `description: "Generated by create next app"`. On a
   public URL that's the browser tab and every link preview. Fix it in Phase 2, when
   public pages first appear.
2. **Build Phase 3 and 4's new UI mobile-first** — orientation slides, the credential
   sheet, the role switcher, the demo framing callouts. Retrofitting them later costs
   more than building them at 390px in the first place. Treat this as a standing rule
   for the rest of the project, not a Phase 6 task.

### 6a.3 The mobile layout work (the larger half)

Current state, measured:

- `app/(dashboard)/layout.tsx:19-31` renders **10 nav links plus sign-out in one flat
  horizontal `<nav>`** with no responsive collapse. At 390px this wraps into a wall of
  links consuming most of the viewport. **This is the single biggest student-facing
  blocker.** Fix: collapse to a hamburger/sheet below `md:`, or a horizontally
  scrollable tab strip — the latter is less code and fits the "console" aesthetic.
- **15 unprefixed multi-column grids** (13 × `grid-cols-2`, 1 × `grid-cols-3`,
  1 × `grid-cols-5`) won't collapse to one column. Mechanical fix: make the base
  `grid-cols-1` and move the existing count to `sm:` or `md:`. The codebase already
  uses this pattern correctly in 25 other places (`sm:grid-cols-2` etc.), so match it.
- **Two fixed-width panels overflow a phone**: `w-[480px]` and `w-[420px]`. Change to
  `w-full max-w-[480px]`.
- `app/display/[token]/page.tsx` is already the most responsive file in the repo
  (13 breakpoint classes) and is projector-targeted anyway — leave it alone.

**Deliberately out of scope: phone parity for instructor pages.** `/control`,
`/scoring`, `/debrief`, and `/log` are data-dense facilitator tools; anyone running a
class has a laptop. Make them *not broken* on a tablet and stop there.

### 6a.4 The PWA plumbing (the smaller half)

1. **`app/manifest.ts`** — Next 16's native `MetadataRoute.Manifest` export. No
   dependency, no `public/manifest.json`. Needs `name`, `short_name`, `start_url: "/"`,
   `display: "standalone"`, `background_color`/`theme_color` matching the existing
   `bg-slate-950` shell, and `icons` at 192px and 512px plus a `maskable` variant.
2. **Icons.** `public/` currently holds only create-next-app's SVGs
   (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) — delete them.
   Generate PNG icons at 192/512/maskable plus a 180px `apple-touch-icon`.
3. **`public/sw.js` + a client-side registration component.** Keep it minimal and get
   the caching rule exactly right:
   - `/api/*` → **network-only, never cached.** Non-negotiable (6a.1).
   - static shell assets → cache-first with a versioned cache name.
   - navigations → network-first, falling back to a cached shell only so a flaky
     connection doesn't show the browser's dinosaur.

   Chrome's install criteria want a `fetch` handler present; this satisfies that
   without breaking live state. Bump the cache name on every deploy or students get
   stale JS after an update.
4. **`export const viewport`** in `app/layout.tsx` with `themeColor` and
   `viewportFit: "cover"` (so the dark shell reaches the notch), plus the
   `apple-mobile-web-app-*` meta tags iOS still needs.
5. **Install affordance.** Android/Chrome fires `beforeinstallprompt` — capture it and
   show an "Install" button. **iOS fires nothing**: Safari requires a manual
   Share → Add to Home Screen, so detect iOS Safari and render a short instruction
   instead. Show either only to logged-out or first-run visitors; don't nag.

### 6a.5 The iOS storage caveat — a real classroom friction point

**An installed PWA on iOS gets its own cookie/storage partition, separate from
Safari.** A student who logs in via Safari and *then* adds to home screen opens the
icon logged out, and has to re-enter the region credential.

Mitigations, both cheap, do both:
- Sequence the instruction on the credential sheet (3.1): **install first, then log
  in.**
- Put a **QR code on the credential sheet** that opens the app directly, so students
  reach it without typing a URL. Generate the QR server-side as an inline SVG — do
  not add a QR dependency or call an external image service.

### 6a.6 Explicitly rejected: push notifications

Technically available (iOS 16.4+ supports web push in installed PWAs, and push
delivery is free). **It cannot work on this stack.** Hobby-tier Vercel cron is
daily-only and the tick is poll-driven (0.3), so there is no reliable server-side
moment to fire "your deadline is in two minutes" to a student whose app is closed.
The only times we could send are times the user is already looking at the app.

This is blocked by the free tier, not by effort — revisit only if the deployment ever
moves to a plan with sub-daily cron. It is also consistent with the spec's standing
exclusion of notification delivery.

### 6a.7 Checkpoint 6 — stop and report

Lighthouse PWA audit passes; the app installs and launches standalone on both an
Android device and an iPhone; a student can complete a full event-response cycle
(read event → pick option → submit rationale → see the consequence card) at 390px
without horizontal scrolling.

---

## 6. Testing

**Assumption (unanswered at planning time): add Vitest with integration tests against
a real local Postgres.** The logic is overwhelmingly DB-shaped — mocking Drizzle would
prove nothing. If Tim would rather not add a devDependency, the fallback is
`scripts/test-*.ts` run via tsx, but the suite below is the same either way.

### 6.1 Harness

- `npm i -D vitest` (+ `dotenv` already present). `"test": "vitest run"`,
  `"test:watch": "vitest"`.
- `TEST_DATABASE_URL` pointing at a local Postgres — **never Neon**, so
  `db.transaction()` remains impossible to accidentally rely on and tests can't touch
  prod. Fail loudly if it contains `neon.tech`.
- `tests/helpers/db.ts`: truncate all per-session tables, seed static content once
  (`regions`, `events`, `event_chain_links`) via the existing `regionSeed` / `eventSeed`.
- `tests/helpers/session.ts`: `createTestUser()`, `createTestSession(mode)`,
  `actorFor(session, regionId)`.
- Route-handler tests import the handler directly and call it with a `NextRequest`,
  with `vi.mock("@/lib/session-context")` supplying a fabricated `Actor`. No HTTP
  server needed, so the suite stays fast.

### 6.2 `tests/isolation.test.ts` — **the deliverable of Phase 1**

Per spec §2.3. Create two sessions with different owners, then:

1. Run **divergent decisions** in each (session A picks OPTIMAL on EVT-001, session B
   picks CRITICAL_FAILURE), score both, and assert A's `model_state` is unchanged by
   B's activity and vice versa.
2. Assert **invisibility**: for every per-session table, a query scoped to A returns
   zero rows belonging to B. Drive this from a **list of all per-session tables in
   one place** so a newly added table fails the test until it's classified.
3. Assert **immutability across the boundary**: calling each mutating route as A's
   actor with B's IDs (decision, dispatch, trade offer, snap vote, budget cycle,
   emergency request, announcement, market request) returns 404/403 and changes
   nothing. This is the ownership audit (1.10) as executable tests.
4. Assert **independent ticks**: `processDeadlines(A)` does not update B's
   `lastTickAt`; A's throttle does not block B's tick.
5. Assert **independent economies**: WHO HQ funds/stock in A are untouched by
   purchases in B.

### 6.3 `tests/concurrency.test.ts`

Per AGENTS.md's standing rule about money movement — test concurrent requests, not
just the happy path. Fire N parallel `tryDeductRegionField` / market-purchase /
trade-accept calls against one region and assert exactly one succeeds and the balance
never goes negative. Run the same against **two sessions in parallel** to prove the
atomic guards are session-scoped.

Also assert, as a test: **no source file contains `db.transaction(`.** Cheap
regression guard on the one constraint that breaks only in production.

### 6.4 Phase-specific suites

- `tests/accounts.test.ts` (Phase 2) — reserved usernames, `@` rejection, case-insensitive
  uniqueness, bcrypt round-trip, rate-limit counter behavior.
- `tests/instructor-mode.test.ts` (Phase 3) — `createSession` produces 6 teams +
  6 model states + 6 credentials; a crash simulated between steps leaves a `'setup'`
  session invisible to every read path; display-token lookup 404s on a wrong token and
  **never returns team-private fields while status is `running`** (assert on the exact
  field list from `display/route.ts:15-22`).
- `tests/autoplayer.test.ts` (Phase 4) — tier sampling matches the profile
  distribution over many draws; unaffordable options are filtered; autoplayed
  decisions go through `submitDecision` and produce the same `model_state` movement a
  human choice would; an occupied region is never autoplayed; the four
  no-structured-option events produce a valid submission (allocation sums to exactly
  180,000).
- `tests/scaling.test.ts` (Phase 5) — idle session stops ticking; archival transitions;
  `?since=` returns unchanged; per-user and global caps reject with the right status.
- **Phase 6 is verified in a browser, not in Vitest.** Playwright with
  `browser.newContext({ ...devices['iPhone 13'] })` — assert no horizontal overflow
  (`document.documentElement.scrollWidth <= innerWidth`) on every student-facing
  route, and that the dashboard nav collapses. Plus one non-negotiable unit-level
  check on the service worker: **assert `sw.js` never caches a `/api/` path**, since
  getting that wrong shows students a stale epidemic and is the failure mode most
  likely to survive review unnoticed.

### 6.5 Manual / end-to-end verification

Keep AGENTS.md's existing convention — it's good and it's what the codebase's history
uses. Per phase:

```bash
# local Postgres
DATABASE_URL=postgres://... npm run db:push && npm run db:seed && npm run dev
```

Then drive with `curl` and a cookie jar per login (`/api/auth/csrf` →
`POST /api/auth/callback/credentials`). **New in this project:** run *two* sessions
concurrently in every manual pass and confirm neither is detectable in the other.

For UI work use Playwright against `/opt/pw-browsers/chromium` with a fresh
`browser.newContext()` per login. Phase 5's load check: script 5-10 concurrent demo
sessions polling `/api/dashboard`, and watch that per-poll DB writes flatten once the
sessions go idle.

Before every checkpoint: `npm run build` (type-checks) and `npm run lint`, both clean.

---

## 7. Execution order and standing rules

| Phase | Deliverable | Checkpoint |
|---|---|---|
| 0 | §1 investigation | **Done — see Phase 0 findings above.** Read them; don't redo them. |
| 1 | Multi-tenancy refactor | Isolation suite green; ownership-check table re-reported complete |
| 2 | Public accounts | Register → log in → create session → log out → log back in |
| 3 | Instructor Mode | Full session with session-scoped credentials + projector display, alongside a second concurrent session |
| 4 | Demo Mode | Solo run completes; model visibly moves; debrief + shadow sim render |
| 5 | Scaling hygiene | Reaping, backoff, caps verified under simulated load |
| 6 | Mobile layout + PWA | Installs standalone on Android and iPhone; full event-response cycle works at 390px with no horizontal scroll |

**Stop and report at each checkpoint.** Do not run the whole thing end to end.

Two Phase 6 items are pulled forward and must not wait: the create-next-app metadata
fix (Phase 2) and building all new Phase 3/4 UI mobile-first (6a.2).

### Standing rules

- **Never introduce `db.transaction()`.** It type-checks locally and throws at runtime
  on Neon's HTTP driver. Single-statement atomic updates only —
  `lib/db-atomic.ts:1-26` explains the full reasoning; read it before touching money.
- **Multi-step writes fail toward destroying value**, never toward a
  broken-but-live state. Debit before credit; insert children before flipping a
  session live.
- **`lib/regions.ts` remains the only place the six region codes are declared.** Import
  `REGIONS`; never inline the array.
- **Preserve the simulation design.** `simulation-docs/` is the source of truth for
  *what the simulation is*; the 40/30/30 weights and four-tier thresholds in
  `lib/scoring.ts` are explicitly marked do-not-simplify. Software structure is free
  to change; pedagogy is not.
- **Preserve the existing code comments.** This codebase documents its reasoning
  inline and unusually well. When a comment's subject moves from global to
  per-session, update the wording — don't delete the explanation.
- **Stay inside the free tiers.** Vercel Hobby and Neon free are hard constraints, not
  preferences. No paid API on any request path, no always-on service, no dependency
  that implies a hosted backend. Where a feature can't be built within them — web push
  (6a.6) is the worked example — say so and drop it rather than reaching for a plan
  upgrade.
- **Build new UI mobile-first** from Phase 3 onward (6a.2). Students are on phones.
- **Don't build past the spec.** Invite-based multiplayer, LLM autoplay, and email
  delivery are excluded. If one seems necessary to finish a phase, say so and stop.
- **Update the README as you go.** Its "Part 1 — Setup Guide for Instructors" (line
  115) documents fixed credentials and single-session operation and becomes wrong the
  moment Phase 1 lands. A stale setup guide on a public repo is worse than none.
  Update `AGENTS.md` too — its "Logins are shared per region" and "globalState
  singleton" constraints both change here.
- **Commit per phase** on `claude/who-sim-multi-tenant-plan-q4ubhn`, with the
  checkpoint report in the commit message.

---

## 8. Definition of done

A stranger visits the public URL, creates an account in under a minute, clicks into
demo mode, and within 10-15 minutes comes away understanding: that decisions are
scored on evidence, political realism, and equity rather than correctness; that the
regions are unequal on purpose; and that the debrief compares them against a
counterfactual rather than an answer key.

Separately, an instructor creates a session, receives six region credentials, runs a
real class through it on a projector, and reaches a debrief — **without the existence
of any other concurrent session being detectable in their data.**

And a student does all of that from a phone they added to their home screen.

---

## Appendix — decisions taken at planning time

Tim confirmed these; each remains cheap to reverse.

1. **Test harness:** Vitest + real local Postgres (§6.1). Fallback: `tsx` scripts.
2. **Existing Neon data:** disposable — wipe, `db:push`, re-seed static content. The
   repo already ships an instructor reset button that wipes everything, so nothing
   durable is at risk. If a deployed session ever must be preserved, the alternative
   is a one-time backfill stamping every row with a single legacy session id — that
   has to be decided before Phase 1 starts, not after.
3. **The four events with no structured options** (0.4): placeholder autoplayer
   behavior, clearly marked, rather than dropping EVT-006 from the demo.
4. **Region-credential plaintext hints** (3.1): stored so the credential sheet can be
   re-rendered mid-session; cleared at completion. Alternative is a regenerate button.
5. **PWA:** in scope as Phase 6, within the free tier. Push notifications explicitly
   rejected as unbuildable on Hobby-tier cron (6a.6).
