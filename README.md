# Operation Veiled Horizon — WHO Pandemic Simulation

A multi-user web app prototype of the *Operation Veiled Horizon* WHO pandemic
simulation. Six teams (one per WHO region) and one instructor respond to a
scripted/adaptive event queue; the instructor scores each submission across
three weighted dimensions, which drives a live, shared model of the outbreak.

Full pedagogical design lives in `simulation-docs/`. This README covers the
software: setup, deployment, and login administration.

## Stack

Next.js (App Router) + Drizzle ORM + Postgres + NextAuth (credentials) +
TanStack Query, deployed on Vercel. Deadline enforcement piggybacks on the
polling traffic dashboards already generate (see the Cron note below).

## Local Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL and AUTH_SECRET (openssl rand -base64 32)
npm run db:push        # create tables
npm run db:seed        # seed regions/events + print login credentials
npm run dev
```

## Deploying to Vercel

1. Push this repo to GitHub, import it into Vercel.
2. Add a Postgres database (Vercel's Neon integration is the easiest path) and
   copy its connection string into the `DATABASE_URL` env var.
3. Set `AUTH_SECRET` (generate with `openssl rand -base64 32`).
4. Vercel automatically trusts its own host, so `AUTH_TRUST_HOST` is not
   needed in production — it's only required for `next start` outside Vercel.
5. Optionally set `CRON_SECRET` (Vercel sets this automatically for you when
   you add a cron job — the `/api/cron/deadlines` route already checks for it).
6. After the first deploy, run `npm run db:push && npm run db:seed` against
   the production `DATABASE_URL` (locally, pointed at the prod connection
   string, or via Vercel's CLI) to create tables and seed content.

### Note on deadline enforcement (Hobby vs. Pro plans)

Vercel's free Hobby plan only allows cron jobs that run once a day, which is
too coarse for a compressed ~60 minute session. Rather than require a paid
plan, HARD/SOFT deadline enforcement (see `lib/deadline.ts`) runs
opportunistically on every dashboard/display poll — which happens every
10-15 seconds as long as at least one team dashboard or the projector display
is open, which is true for essentially the entire session. The
`vercel.json` cron entry is a once-daily fallback safety net, not the primary
mechanism. If you're on a Pro plan and want tighter enforcement even when no
one has a page open, you can change its schedule to `* * * * *` (every
minute) yourself.

## Login Administration

Every region shares **one login for the whole team** (see the design
discussion on shared-per-region logins vs. individual student accounts —
this prototype uses shared logins for a fast-paced compressed test session).

- **Usernames are fixed**: `afro`, `amro`, `emro`, `euro`, `searo`, `wpro`, and
  `instructor`. No email addresses are used anywhere in this prototype.
- **Passwords are fixed**, defined in `lib/db/seed-data/credentials.ts`, and
  print every time you run `npm run db:seed` (or the "Database setup /
  reset" GitHub Actions workflow) — they're the same every time, not
  regenerated, so you only need to look them up once and can reuse them
  across game sessions. Edit that file directly if you want different
  passwords, then re-seed to apply the change.
- Re-running `npm run db:seed` any time is safe — it resets regions/events
  to their seed content and re-applies the fixed credentials; it does not
  touch decisions, scores, or model state from an in-progress game (those
  live in separate tables this script never truncates).
- **To set one specific account's password** without touching anything else:
  ```bash
  npm run db:set-password -- afro your-chosen-password
  ```

## Running a Compressed (~60 Minute) Test Session

`global_state.fast_mode_multiplier` (seeded to `1/60`) compresses every
event's stated deadline window (in hours) into real minutes — a "2-hour HARD
window" becomes a 2-minute real window. Adjust this value directly in the
database (or via a future admin control) if 60 minutes runs too fast or too
slow once you've tried it live. The blackout window (10pm–6am Phoenix) is
disabled by default (`respect_blackout_window = false`) since it's irrelevant
for a single live session.

## Public Display Screen

Open `/display/<any-token>` on the projector — no login required, and the
route only ever reads public-safe aggregate data (see `app/api/display/route.ts`
for exactly what is and isn't exposed). Push events to it from the
instructor's Control panel via "Push to Global Display," which is a distinct,
deliberate action from dispatching an event to teams.

## What's Implemented vs. What's a Stretch Goal

Implemented: all 16 events seeded with chain dependencies and fast-mode
deadlines, shared/private dashboard views, structured+rationale decision
submission, priority-sorted scoring inbox with one-click fast-path and
mandatory-review pinning, the 40/30/30 scoring formula and four-tier
consequence mapping, live model state + append-only history, coordination
log, instructor model override + action log, public projector display with
world map and ticker, deadline enforcement, a paired in-game/real-time clock
shown on every screen (see `lib/sim-clock.ts`), and a first-login
orientation page for teams and a step-by-step guide for the instructor.

Not implemented (see `simulation-docs/07-open-questions.md` for the original
scoping discussion): full automated adaptive-trigger evaluation (dispatch is
manual, with trigger conditions and chain status shown to the instructor),
email notifications, and a debrief page that is functional but intentionally
minimal (raw comparisons rather than a polished report).
