# Data Model — Suggested Schema

This is a **suggested** relational schema derived from the Decision Log / Sheets structure in the original design (see 05-product-requirements.md for the functional requirements this supports). Claude Code should feel free to adapt field names/types to whatever ORM/database is chosen — the point is to capture the entities and relationships, not to mandate exact SQL.

## Entities

### `regions` (static reference data — seed once from 04-regions.md)
```
id                    (AFRO | AMRO | EMRO | EURO | SEARO | WPRO)
full_name
role_title
hq_location
member_states_desc
population_desc
starting_fund
starting_ppe_days
starting_antivirals
starting_hcw_surge_pct
starting_surveillance_index
starting_cfr_multiplier
population_weight
profile_markdown        -- full text of their section from 04-regions.md, for display
```

### `teams`
```
id
region_id             (FK -> regions.id, one team per region)
created_at
```

### `users`
```
id
email
name
role                  (student | instructor)
team_id               (FK -> teams.id, null for instructor)
```

### `model_state` (current live state per region — mutable, updated on every scored decision)
```
id
region_id             (FK -> regions.id)
day                   (1-5, current simulation day)
rt                    (current effective reproduction number)
cfr_multiplier
confirmed_cases
estimated_true_cases
deaths
hospital_capacity_pct
surveillance_index
fund_remaining
ppe_days_remaining
antivirals_remaining
hcw_surge_pct
political_tension_index   (0-100)
public_trust_index        (0-100)
updated_at
```

### `model_state_history` (append-only log — critical for after-action reports; do not skip this)
```
id
region_id
day
snapshot_json         -- full copy of model_state fields at this point in time
reason                -- e.g. "EVT-006 scored: OPTIMAL" or "manual override by instructor"
created_at
```

### `global_state` (singleton row, or keyed by simulation instance if supporting multiple)
```
id
current_day
escalation_state       (GREEN | AMBER | RED)
media_pressure_index    (0-100)
simulation_status       (not_started | running | paused | completed)
updated_at
```

### `events` (static reference data — seed once from 03-events.md)
```
id                    (e.g. "EVT-001")
title
day                   (1-5)
category              (one of the 7 decision categories from 02-decision-matrix.md)
deadline_type         (HARD | SOFT | NONE)
deadline_window_desc   -- human-readable, e.g. "2-hour window"
scope                 (GLOBAL | REGIONAL | MULTI)
narrative_markdown
decision_prompt_markdown
structured_options_json   -- array of {label, text} if applicable, else null
chain_prev            (nullable, FK -> events.id)
chain_next            (nullable, FK -> events.id)
trigger_condition_desc
consequences_json     -- {optimal, adequate, inadequate, critical} text blocks
model_delta_desc
no_response_fallback_tier   -- which tier applies if deadline expires with no submission
```

### `event_dispatches` (one row per time an event actually fires for a given target)
```
id
event_id              (FK -> events.id)
target_team_id         (FK -> teams.id, null if truly global/all-teams -- or create one row per team for global events, simpler to query)
dispatched_at
deadline_at            (calculated from dispatched_at + deadline_window)
reminder_sent_at        (nullable, for SOFT deadlines)
status                 (queued | dispatched | responded | scored | closed)
```

### `decisions` (team submissions)
```
id
event_dispatch_id       (FK -> event_dispatches.id)
team_id                (FK -> teams.id)
submitted_by_user_id     (FK -> users.id)
structured_choice        (nullable, e.g. "A")
rationale_text
resource_allocation_json  (nullable -- used by EVT-006/EVT-012 style events: {AFRO: 30000, AMRO: 20000, ...})
coordinated_with_teams_json  (nullable, array of team_ids)
submitted_at
```

### `scores` (instructor scoring of a decision)
```
id
decision_id            (FK -> decisions.id, one-to-one)
evidence_score          (1-4)
political_score          (1-4)
equity_score            (1-4)
composite_pct           (calculated: (evidence*0.4 + political*0.3 + equity*0.3)/4*100)
tier                    (OPTIMAL | ADEQUATE | INADEQUATE | CRITICAL_FAILURE)
tier_overridden          (boolean -- did instructor override the auto-computed tier)
override_reason          (nullable text)
scored_by_user_id         (FK -> users.id)
scored_at
```

### `coordination_messages` (minimum-viable inter-team communication -- see 07-open-questions.md)
```
id
from_team_id            (FK -> teams.id)
to_team_id              (FK -> teams.id, nullable if broadcast to all)
event_dispatch_id        (nullable FK -> event_dispatches.id, for context)
message_text
sent_at
```

### `instructor_actions` (audit log)
```
id
instructor_user_id       (FK -> users.id)
action_type            (dispatch_event | pause_simulation | resume_simulation | override_score | edit_model_state | ...)
target_desc             -- free text description of what was affected
reason
created_at
```

## Key Relationships & Notes

- `events` and their `consequences_json`/`model_delta_desc` are **static content seeded from 03-events.md** -- they should not need to be edited through the app UI for a prototype; treat them as fixture/seed data, not user-editable records. (An instructor content-editing UI for events is a nice-to-have, not a requirement.)
- `model_state` is the *current* live number the dashboard reads. `model_state_history` is what makes the after-action report (EVT-014/EVT-016) possible -- **do not build a system that only tracks current state**, since the whole pedagogical payoff of the simulation depends on being able to show trajectories over time and compare decisions across days (e.g., EVT-006 vs EVT-012).
- A `score` being finalized is the trigger point that should (a) write to `model_state_history`, (b) update `model_state`, and (c) mark the `event_dispatch` as `scored`.
- For GLOBAL-scope events (like EVT-001, EVT-006), create one `event_dispatches` row per team so each team's individual response/scoring can be tracked independently, even though the narrative content is shared.
- The `resource_allocation_json` field on `decisions` exists specifically for the vaccine-allocation events (EVT-006, EVT-012) where a team submits a full six-region split, not just a choice about their own region.

## Seed Data Sources

| Table | Seed from |
|---|---|
| `regions` | 04-regions.md cross-region data table + per-region narrative sections |
| `events` | 03-events.md, one block per event |
| `model_state` (initial) | 01-scenario.md Day-1 dashboard table + 04-regions.md resource table |
| `global_state` (initial) | day=1, escalation_state=GREEN, media_pressure_index=0, simulation_status=not_started |
