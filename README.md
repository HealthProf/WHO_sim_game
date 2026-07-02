# Operation Veiled Horizon — WHO Pandemic Simulation

A multi-user web app that runs the *Operation Veiled Horizon* WHO pandemic
simulation. Six teams (one per WHO region) and one instructor respond to a
scripted/adaptive event queue; the instructor scores each submission across
three weighted dimensions, which drives a live, shared model of the
outbreak. Full pedagogical design (scenario, scoring rubric, event script)
lives in `simulation-docs/`.

**This README has two versions.** If you're setting this up for a class and
don't have a programming background, start with **Part 1**. If you're
comfortable with a terminal, npm, and deploying web apps, skip to **Part 2**.

---

# Part 1 — Setup Guide for Instructors (No Coding Experience Needed)

Everything below is done by clicking around in a web browser — you will not
need to install anything or open a terminal. You're doing three things:
putting the app online (Vercel), giving it a database to store the game in
(Neon, added through Vercel), and loading the game's content plus the class
login passwords (one button click, through GitHub).

Budget about 20 minutes for the one-time setup. You only do this once per
semester (or once, ever, if you just re-reset the database between classes).

## Step 1: Create two free accounts

1. **GitHub** — go to github.com/signup and create an account, if you don't
   already have one.
2. **Vercel** — go to vercel.com/signup and sign up using **"Continue with
   GitHub"**. This links the two accounts together, which makes everything
   below simpler.

## Step 2: Get your own copy of the project

1. Open the project's GitHub page (the link you were given — it will look
   like `github.com/<something>/WHO_sim_game`).
2. Click the **Fork** button near the top right of the page, then click
   **Create fork**. This makes your own personal copy of the project under
   your GitHub account, which you can deploy and reset freely without
   touching the original.

## Step 3: Put it online with Vercel

1. Go to vercel.com/new.
2. Find your forked repository in the list and click **Import** next to it.
   (If you don't see it, click "Adjust GitHub App Permissions" and grant
   Vercel access to it.)
3. You'll land on a "Configure Project" screen. **Don't click Deploy yet** —
   first add the database in the next step, so the app has somewhere to
   store the game.

## Step 4: Add a database

1. Still on the Configure Project screen (or, if you already deployed,
   go to your Project → the **Storage** tab), click **Create Database**.
2. Choose **Neon** (Serverless Postgres) from the list, follow the prompts,
   and connect it to your project. The free tier is more than enough for
   this app.
3. Vercel will automatically add a database connection value to your
   project's settings. Go to **Project → Settings → Environment Variables**
   and confirm there's an entry named exactly `DATABASE_URL`. If Vercel
   named it something else instead (e.g. `POSTGRES_URL`), click **Add New**,
   name it `DATABASE_URL`, and paste in the same value.

## Step 5: Add one more required setting

Still on **Project → Settings → Environment Variables**, click **Add New**
and create one more entry:

- **Name:** `AUTH_SECRET`
- **Value:** a random string of 32+ characters, used to keep logins secure.
  The easiest way to get one: use your browser's or password manager's
  "generate a strong password" feature and paste the result in here. The
  exact characters don't matter — it just needs to be long and random.

Leave everything else at its default.

## Step 6: Deploy

Go to your Project's **Deployments** tab and trigger a deploy (click
**Redeploy** if one already ran, so it picks up the settings you just
added). Wait for it to finish — it'll say "Ready" with a green checkmark.

Your site's address is shown on the Project's **Overview** page, something
like `your-project-name.vercel.app`. Bookmark it — this is the page
everyone (you and every team) will log into.

## Step 7: Load the game content and get the class logins

The app needs its database populated with the simulation's events and the
login accounts for each region. This is one button click on GitHub — no
terminal needed.

1. **First, give GitHub the same database address you gave Vercel:**
   - Go back to your forked repository on GitHub.
   - Click **Settings → Secrets and variables → Actions**.
   - Click **New repository secret**. Name it `DATABASE_URL`. For the
     value, go back to Vercel → your Project → **Storage** → click your
     database → find the connection string (often under a "Quickstart" or
     ".env.local" tab) and copy/paste the same value used in Step 4.
   - Click **Add secret**.
2. **Run the setup:**
   - On your GitHub repository, click the **Actions** tab.
   - Click **Database setup / reset** in the left sidebar.
   - Click the **Run workflow** button, then confirm.
   - Wait about 30 seconds for it to finish (a green checkmark appears).
3. **Get the login credentials:**
   - Click into the finished run, then click the **db-setup** job, then open
     the **"Seed regions, events, and login accounts"** step.
   - You'll see a printed list of usernames and passwords — one per WHO
     region (`afro`, `amro`, `emro`, `euro`, `searo`, `wpro`) plus one for
     `instructor`. Copy these somewhere safe; you'll hand the region logins
     out to student teams and keep the instructor one for yourself.

You can re-run this workflow any time you want to reset the game back to
its starting state before a new class — it's always safe to run.

## Step 8: Try it out before your class

1. Visit your site's address from Step 6 and log in as `instructor`.
2. Open a **private/incognito browser window** and log in there as one
   region (e.g. `afro`) so you can see both the instructor and student
   views side by side.
3. From the instructor's **Command Center** page, click **Start
   Simulation**, then dispatch the first event and try submitting a
   response as the team to make sure everything flows end to end.

## Running an actual class session

- You (the instructor) log in, go to the **Command Center**, and click
  **Start Simulation** when you're ready to begin.
- Each team opens your site's address on a laptop or phone and logs in with
  their region's shared login — the whole team can share one device and
  login, or each student can log in separately with the same team
  credentials.
- Optional — a shared projector/screen view: open
  `your-project-name.vercel.app/display/anything` (replace "anything" with
  any word you like — no login required) on the room's projector. It shows
  a shared public dashboard everyone can see. Push a dispatched event to it
  from the Command Center's **"Push to Global Display"** button when you
  want the whole room to see it.
- Nothing needs to be "saved" — everything the app does is stored in the
  database automatically as the session runs.

## Resetting between classes

Just re-run **Database setup / reset** from the GitHub Actions tab again
(Step 7). It restores the six regions to their starting conditions and
reloads the full event script — it does **not** change your Vercel
deployment or any of the settings you configured above, so you only ever
have to do Steps 1–6 once.

## If something goes wrong

- **Nobody can log in / "invalid credentials" for everyone:** the database
  was likely never seeded (Step 7), or the `DATABASE_URL` value in Vercel
  and the `DATABASE_URL` secret in GitHub don't match exactly. Re-check
  both.
- **The site shows an error page or a blank screen:** go to Vercel → your
  Project → **Deployments** → click the most recent one → **Runtime Logs**
  to see the actual error message. If you're stuck, share that message with
  whoever set this project up for you (or open an issue on the GitHub
  repository) — it's much easier to diagnose with the exact message than
  without it.
- **You want different passwords than the auto-generated ones:** this
  requires editing one file in the code
  (`lib/db/seed-data/credentials.ts`) and asking a developer to help, or
  following Part 2's local setup to do it yourself.

---

# Part 2 — Quick Reference for Developers

## Stack

Next.js (App Router) + Drizzle ORM + Postgres + NextAuth v5 (credentials) +
TanStack Query, deployed on Vercel with Neon Postgres. Deadline enforcement
piggybacks on the polling traffic dashboards already generate (see the Cron
note below) rather than relying on a real cron job.

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
   confirm the resulting env var is named `DATABASE_URL` (rename/add it if
   the integration used a different name).
3. Set `AUTH_SECRET` (generate with `openssl rand -base64 32`).
4. Vercel automatically trusts its own host, so `AUTH_TRUST_HOST` is not
   needed in production — it's only required for `next start` outside Vercel.
5. Optionally set `CRON_SECRET` (Vercel sets this automatically for you when
   you add a cron job — the `/api/cron/deadlines` route already checks for it).
6. After the first deploy, run `npm run db:push && npm run db:seed` against
   the production `DATABASE_URL` (locally, pointed at the prod connection
   string; or trigger the repo's "Database setup / reset" GitHub Actions
   workflow, which needs a `DATABASE_URL` repository secret set separately
   from the Vercel env var).

### Note on deadline enforcement (Hobby vs. Pro plans)

Vercel's free Hobby plan only allows cron jobs that run once a day, which is
too coarse for a compressed ~60 minute session. Rather than require a paid
plan, HARD/SOFT deadline enforcement — along with passive drift, snap-vote
expiry, budget-cycle timers, and social-metric milestones (see
`lib/deadline.ts`) — runs opportunistically on every dashboard/display poll,
throttled server-side (`globalState.lastTickAt` + `TICK_THROTTLE_SECONDS` in
`lib/config.ts`) so concurrent pollers don't re-trigger it. This fires every
10-15 seconds as long as at least one team dashboard or the projector
display is open, which is true for essentially the entire session. The
`vercel.json` cron entry is a once-daily fallback safety net, not the
primary mechanism. If you're on a Pro plan and want tighter enforcement even
when no one has a page open, you can change its schedule to `* * * * *`
(every minute) yourself.

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
window" becomes a 2-minute real window. `global_state.intensity_multiplier`
(the instructor's live "tempo dial" on the Command Center) further scales
this on top, in the 0.5x–2.0x range, for in-session pacing control. Adjust
`fast_mode_multiplier` directly in the database if 60 minutes runs too fast
or too slow overall. The blackout window (10pm–6am Phoenix) is disabled by
default (`respect_blackout_window = false`) since it's irrelevant for a
single live session.

## Public Display Screen

Open `/display/<any-token>` on the projector — no login required, and the
route only ever reads public-safe aggregate data (see `app/api/display/route.ts`
for exactly what is and isn't exposed). Push events to it from the
instructor's Control panel via "Push to Global Display," which is a distinct,
deliberate action from dispatching an event to teams.

## What's Implemented vs. What's a Stretch Goal

Implemented: all 16 core events plus a set of social-consequence and
adaptive-trigger events, seeded with chain dependencies and fast-mode
deadlines; shared/private dashboard views; structured+rationale decision
submission; a priority-sorted scoring inbox with one-click fast-path and
mandatory-review pinning; the 40/30/30 scoring formula and four-tier
consequence mapping; live model state + append-only history plus a
counterfactual "Optimal" shadow simulation for after-action comparison;
resource marketplace, region-to-region trading, pledges, periodic budget
cycles, and emergency funding requests; social metrics (public trust,
population happiness, political tension) with automatic milestone
rewards/escalation events; a coordination log plus a private diplomatic
back-channel with a chance of public leaks; human-detail vignette cards and
personified recurring stakeholders (journalist/MSF/diplomat) reacting to
extreme outcomes; a scripted full-screen "dramatic moment" staging for the
simulation's emotionally pivotal event; a private forward-looking projection
tool and a late-game "counterfactual ghost" preview for teams; end-of-game
per-region narrative "chapters"; a facilitator director's timeline,
tempo/drama dial, scripted-interjection library, and action log; a public projector
display with a world map, ticker, and shared world-health indicator;
deadline enforcement; a paired in-game/real-time clock shown on every screen
(see `lib/sim-clock.ts`); and a first-login orientation page for teams and a
step-by-step guide for the instructor.

Not implemented (see `simulation-docs/07-open-questions.md` for the original
scoping discussion): full automated adaptive-trigger evaluation (dispatch is
manual, with trigger conditions and chain status shown to the instructor)
and email notifications.
