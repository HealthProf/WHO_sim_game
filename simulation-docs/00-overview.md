# Operation Veiled Horizon — WHO Pandemic Simulation

## What This Is

A week-long educational simulation for a global health university course. Students are organized into six teams, each representing one WHO regional office (AFRO, AMRO, EMRO, EURO, SEARO, WPRO). Over five simulation days, teams respond to a novel pandemic outbreak through a series of scripted and adaptive decision events. Teams are **collaborative, not competitive** — they represent different parts of the same institution (WHO) responding to a shared global crisis, and the simulation is designed to reward inter-regional coordination.

This was originally designed to run entirely inside Google Workspace (Gmail, Sheets, Forms, Sites, Apps Script). It is now being rebuilt as a standalone multi-user web application, deployed on Vercel, with real teams logging in and playing simultaneously.

## How to Use These Documents

Read in this order:

1. **00-overview.md** (this file) — orientation and philosophy
2. **01-scenario.md** — the pandemic scenario and epidemiological model. This is simulation *content*, not app design.
3. **02-decision-matrix.md** — the scoring system. This is the pedagogical core of the whole project — do not simplify or skip this.
4. **03-events.md** — the full event queue: what happens, when, and what triggers what. This is the game's script.
5. **04-regions.md** — the six team profiles and starting conditions.
6. **05-product-requirements.md** — what the *web app* needs to do. This is where Workspace-specific mechanics get translated into web app requirements.
7. **06-data-model.md** — a suggested database schema derived from everything above.
8. **07-open-questions.md** — decisions intentionally left open for you (Claude Code) or the instructor to resolve during the build.

Files 01–04 define **what the simulation is**. Files 05–07 define **how to build it as software**. Keep that separation in mind — if you need to make an implementation decision that isn't covered in 05–07, look to 01–04 for the pedagogical intent, not for literal technical instructions.

## Critical Design Philosophy: Adapt the Mechanism, Preserve the Intent

The original design used Google Workspace tools to solve specific problems. Each tool choice mapped to an underlying need — and that need is what must be preserved, not the specific tool.

| Original Workspace Mechanism | Underlying Need | Web App Translation (suggested, not mandatory) |
|---|---|---|
| Event arrives via Gmail to a shared Group inbox | Team gets notified an event is active and needs a response | In-app notification + dashboard alert badge; optionally email notification as a supplement |
| Team submits response via Google Form | Structured decision capture with required rationale | In-app decision submission form tied to team's authenticated session |
| Google Sheets disease model with manual/formula updates | A live, shared, calculable model of outbreak state | Server-side model state in the database, recalculated on decision submission or on a scheduled job |
| Google Sites "Situation Room" dashboard | Shared visibility into global and regional status for all teams | Real-time (or near-real-time) dashboard view in the app, reading from the same backend state |
| Apps Script time-based trigger for event dispatch | Events fire on a schedule, with adaptive conditions, respecting a blackout window | Server-side scheduled job (cron / Vercel Cron / equivalent) with the same trigger logic |
| Inter-regional email between Group inboxes | Teams can communicate directly with each other during the simulation | In-app messaging between teams, OR a simpler shared "coordination log" — this is the one mechanic most worth reconsidering; see 07-open-questions.md |
| Facilitator manually scores open-ended rationale in Sheets | Instructor judgment applied to qualitative decision quality | Instructor/admin view with a scoring interface tied to each submission |

**Do preserve faithfully:** the three-dimension scoring model (Evidence 40% / Political Realism 30% / Equity 30%), the four consequence tiers, all 16 events and their chain/trigger logic, the regional starting asymmetries (resources, CFR multipliers, surveillance index), and the slow-burn-to-peak-pressure narrative arc across the 5 days.

**Free to redesign:** the specific delivery mechanism for notifications, the exact UI for decision submission, whether team coordination happens via messaging vs. a shared log vs. something else, and how the instructor scoring workflow is presented.

## Non-Negotiable Constraints

- **Multi-user, real-time-ish, team-based.** Each region is a team account (likely multiple students sharing one team login, or one login with multiple associated users — see 07-open-questions.md). Teams must not see other teams' private decision rationale, but must see the shared global dashboard.
- **Instructor/facilitator role.** One account type with visibility into everything, manual override capability on event dispatch and scoring, and the ability to pause the simulation.
- **Deadline logic matters pedagogically.** Hard deadlines auto-apply a consequence at expiry. Soft deadlines send a reminder partway through, then auto-apply at expiry. This is not just UX — the pedagogy depends on real time pressure.
- **Blackout window.** No events fire between 10:00pm–6:00am Arizona time (America/Phoenix, no DST). This must be respected by any scheduling logic.
- **Chain integrity.** Certain events are sequential (a team's answer to one event changes options/framing in a later event). This dependency chain must not be short-circuited by scheduling logic firing events out of order.

## What "Done" Looks Like for a Prototype

A working version where: six team accounts and one instructor account can log in; the instructor can trigger the simulation start; events fire (manually triggered by instructor is an acceptable prototype simplification — see 07-open-questions.md); teams see their event, submit a decision with rationale; the instructor scores it; the model state updates; the dashboard reflects the update for all teams. One full event cycle working end-to-end is more valuable than sixteen events with a broken pipeline.
