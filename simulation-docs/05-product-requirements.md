# Product Requirements — Web App

This translates the simulation design (01–04) into concrete requirements for a multi-user web application deployed on Vercel. This file is about **what the software must do**, not the pandemic content itself.

## User Roles

| Role | Count | Access |
|---|---|---|
| Team member | Multiple per team, 6 teams | Can view/act only as their own team. Sees own team's full profile, the shared global summary, the public dashboard, and any events targeted at their team. Cannot see other teams' private decision rationale or internal deliberation. |
| Instructor / Facilitator | 1 (possibly 2+ for co-instructors/TAs) | Full visibility into all teams, all decisions, all model state. Can manually trigger/pause events, override consequence tiers, score open-ended rationale, adjust model state directly, and view an audit log of their own actions. |

**Team membership:** a team is 3–5 students sharing one region. Recommend implementing this as: one team account/workspace per region, with multiple individual user logins associated to that team (not a single shared password) — this preserves individual accountability while giving the team a shared view and shared submission history. Exact auth mechanism is open — see 07-open-questions.md.

## Core Functional Requirements

### 1. Authentication & Team Assignment
- Instructor can create the 6 team workspaces and invite/assign students to each.
- Students authenticate individually (magic link, OAuth, or simple credentials — instructor's call, likely constrained by what's easy to stand up quickly for a prototype).
- Session clearly indicates which team the logged-in user belongs to; UI should never let a user accidentally view or act as another team.

### 2. Event Delivery
- Each event (see 03-events.md) must be deliverable to its target team(s) — either specific regions or a global broadcast.
- On dispatch, the targeted team(s) should see: an in-app notification/alert, the event appearing on their team dashboard, and (optional but recommended) an email notification as a supplementary channel.
- Events carry: title, narrative text, decision prompt, structured options (if any), deadline type (HARD/SOFT/NONE) and window, and — critically — a live countdown or clear deadline indicator once dispatched.
- The instructor needs a manual "dispatch now" control for every event, for the prototype and likely for real use too (see scheduling note below).

### 3. Decision Submission
- A submission form tied to the specific event and the submitting team.
- Fields vary by event but generally include: structured choice (if applicable), free-text rationale (with a minimum length requirement per event), resource allocation numbers (for events like EVT-006/EVT-012), and a coordination flag (did they coordinate with other regions first, and with whom).
- One submission per team per event (or allow resubmission before the deadline — instructor's call, but if allowed, keep a full revision history, don't just overwrite).
- On submission: timestamp it, mark the event as "responded" for that team, and queue it for scoring.

### 4. Scoring & Consequence Application
- Instructor-facing scoring interface: for each submission, enter 1–4 on Evidence/Political/Equity dimensions (see 02-decision-matrix.md for the weighting formula and tier thresholds).
- For events with structured options that have deterministic tiers (most events — see each event's `consequences` block in 03-events.md), the app can pre-populate a suggested tier based on the option chosen, which the instructor can accept or override after reading the rationale.
- On scoring finalization: apply the event's specified `modelDelta` to the relevant region(s)' live model state (Rt, CFR multiplier, capacity, political tension index, public trust index, etc. — see 01-scenario.md).
- Model state changes should be visible on the dashboard promptly (real-time is ideal; a few seconds to low-minutes delay is an acceptable prototype simplification).

### 5. Dashboard (the "Situation Room")
- Shared view, visible to all teams: global summary (total cases, deaths, weighted global Rt, simulation day, escalation state GREEN/AMBER/RED), and a per-region status table (confirmed cases, est. true cases, Rt, capacity %, surveillance index, trend indicator).
- Team-specific view (visible only to that team, layered on top of the shared view): their own resource ledger (fund, PPE days, antivirals, HCW surge capacity), their own political tension and public trust indices, and their own event history/decision log.
- Instructor view: everything above for every team simultaneously, plus the model override and event control panels described below.

### 6. Inter-Team Coordination
- Some events explicitly require or reward cross-team coordination (e.g., EVT-006, EVT-007, EVT-011).
- Minimum viable version: a shared coordination log/message board where teams can post messages visible to specific other teams or all teams — simpler to build than full private messaging and still supports the pedagogy (see 07-open-questions.md for the fuller discussion of this tradeoff).
- Whatever the mechanism, coordination activity (who messaged whom, when) should be visible to the instructor, since "did this team proactively coordinate" is itself part of the eventual after-action assessment.

### 7. Event Scheduling & Triggers
- The event queue (03-events.md) has anchor events (fixed timing) and adaptive events (condition-triggered, e.g., "fires when global Rt > 4.0 sustained 12h" or "fires when 2+ regions score Inadequate on EVT-004").
- For a prototype: manual instructor-triggered dispatch for every event is an acceptable and recommended simplification. Automating the full adaptive trigger-condition-evaluation engine is a "if time permits" feature, not a blocker — see 07-open-questions.md.
- If/when automated: respect the blackout window (no dispatch 10pm–6am America/Phoenix) and randomize dispatch time within any event's specified time range.
- Chain integrity must be enforced regardless of automation level: an event with a `chain.prev` dependency should not be dispatchable (even manually) until its prerequisite event has been fully resolved (all target teams have a scored submission, or the deadline has passed and an auto-consequence has been applied).

### 8. Instructor Controls
- Dispatch any event manually, at any time (overriding normal trigger logic).
- Pause the simulation entirely (halts any automated dispatch/deadline-expiry logic; does not affect already-open submission windows).
- Override a computed consequence tier for any submission, with a required short justification note (for the audit trail).
- Directly edit any region's live model state values (Rt, CFR multiplier, resource levels, political tension, public trust) — this is the "manual override" panel from the original Sheets-based facilitator dashboard.
- View an action log of every manual instructor intervention (timestamp, action, region affected, reason).

### 9. Deadline Enforcement
- HARD deadline: at expiry, if no submission exists, auto-apply the event's specified "no response" consequence (usually the Critical Failure or a specific named fallback tier — check each event in 03-events.md, they vary).
- SOFT deadline: send a reminder notification partway through the window (roughly halfway, per each event's spec), then auto-apply the fallback consequence at expiry if still no submission.
- NONE: no deadline; informational events or events explicitly marked with no time pressure.
- This logic needs to run whether or not a human is watching — i.e., it needs to be time-driven (scheduled job), not dependent on a page being open in a browser.

### 10. After-Action / Debrief Artifacts
- At minimum, exportable (or in-app viewable) summaries per 03-events.md's EVT-014/EVT-016 implementation notes: global Rt trajectory across the 5 days, regional CFR actual-vs-optimal, the EVT-006-vs-EVT-012 allocation comparison, a coordination success/failure summary, and the most consequential decisions by model-impact magnitude.
- This can be a simple report page/export rather than a polished feature for the prototype — but the underlying data (full decision log, full model-state history over time, not just current state) needs to be retained to make this possible later. Don't design the database to only store "current state" and discard history.

## Non-Functional Notes

- **This is a course tool, not a production SaaS product.** Prioritize correctness of the pedagogical mechanics (scoring, tiers, chain logic, equity weighting) over polish, scalability, or handling adversarial users.
- **Six teams, one instructor, one week.** Expected concurrent load is trivial (tens of users, not thousands). Do not over-engineer for scale.
- **Data privacy:** student decision content should be treated with normal FERPA-appropriate care, but this is not a high-security application — reasonable auth and access control is sufficient, no need for elaborate security hardening for a prototype.
- **Timezone handling:** all deadline/blackout logic is anchored to America/Phoenix (Arizona does not observe DST, so this is a fixed UTC-7 offset year-round — worth confirming this assumption still holds, but do not build DST-transition logic for this timezone).

## Explicit Non-Goals for the Prototype

- Full automated adaptive-trigger evaluation (manual dispatch is fine)
- Polished real-time collaborative editing / typing indicators for team coordination
- Mobile-native app (responsive web is sufficient)
- Multi-simulation / multi-course-section support (build for one running simulation instance at a time)
