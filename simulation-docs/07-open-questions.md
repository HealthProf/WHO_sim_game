# Open Questions

Decisions intentionally left open. Claude Code should make a reasonable choice for each and note the choice made (e.g., in a README or ADR-style comment) rather than blocking on instructor input — the instructor can course-correct after seeing a working prototype.

## 1. Team Authentication Mechanism

Options: (a) individual student logins (magic-link email or simple username/password) associated with a team workspace, (b) one shared login per team, (c) instructor pre-creates accounts vs. students self-register with an invite code.

**Recommendation:** individual logins via email magic-link (no password management needed), associated to a team at account-creation time via an instructor-issued invite code per region. Preserves individual accountability (useful for the "who submitted this decision" audit trail) without the overhead of a full permissions system.

## 2. Inter-Team Coordination Mechanism

The original design used real email between Google Groups. Options for the web app: (a) full private messaging between teams, (b) a shared coordination log visible to all (less private, but far simpler, and arguably more realistic for an *institutional* simulation where WHO regional directors might reasonably expect their communications to be logged), (c) no in-app mechanism at all — teams coordinate verbally/in-person since it's a classroom setting anyway, and the app just has a checkbox "we coordinated with: [teams]" on the decision form for the record.

**Recommendation for the prototype:** start with (c) — the self-reported coordination checkbox — since it's nearly free to build and captures the data needed for scoring/debrief. Add (b), a shared/broadcast coordination log, as a stretch feature if time permits. Full private messaging (a) is probably not worth the build cost for a prototype and arguably weakens the "institutional accountability" framing that made (b) interesting in the first place.

## 3. Automated Adaptive Event Triggers vs. Manual Dispatch

The full adaptive trigger system (03-events.md's trigger table) is sophisticated — it requires continuously evaluating model state against multiple conditions. Options: (a) build the full automated evaluator now, (b) manual-only for the prototype, with the instructor reading the trigger conditions themselves and clicking "dispatch," (c) partial automation — automate the anchor events (fixed timing) but leave adaptive events to manual instructor judgment.

**Recommendation:** (c). Anchor events firing on schedule is straightforward to automate and removes real workload from the instructor during a live simulation. Adaptive events benefit from a human reading the room anyway (the facilitator notes throughout 03-events.md consistently suggest human judgment calls), so manual dispatch with the trigger conditions displayed as a helpful hint ("this condition is now met") is a reasonable middle ground.

## 4. Real-Time vs. Polling Dashboard Updates

Options: (a) full real-time (WebSockets/Server-Sent Events/similar), (b) polling every N seconds, (c) manual refresh only.

**Recommendation:** polling (every 10-30 seconds) is almost certainly sufficient for six teams and dramatically simpler to build and deploy on Vercel than a persistent WebSocket connection. True real-time is a nice-to-have, not a requirement — nothing in the pedagogy depends on sub-second updates.

## 5. Scoring Workflow Timing

The original design assumed the instructor scores each submission within roughly 2 hours (per the Phase 3 implementation notes in the source material). Options: (a) build an instructor "inbox" of unscored submissions that need attention, with some visual urgency indicator as time passes, (b) no special handling, just a list.

**Recommendation:** (a) is worth the small extra effort — a live simulation depends on the instructor not losing track of pending scoring work, and a simple "X submissions awaiting scoring, oldest is Y hours old" indicator solves most of the risk here.

## 6. Auto-Scoring for Structured-Choice-Only Events

Some events are pure structured-choice (no meaningful open-ended rationale to judge). Should these skip instructor scoring entirely and auto-apply the tier tied to the chosen option?

**Recommendation:** yes, for events explicitly marked as having deterministic option-to-tier mapping with no substantial rationale component. Nearly all events in 03-events.md require a written rationale of some minimum length though, so this will apply to relatively few events — check each event's `decision_prompt` and consequence structure individually rather than assuming.

## 7. What Happens at Simulation End (Day 5 close)

EVT-016 in the original design is an "administrative close" — the app should freeze model state and generate debrief artifacts. Should the app support the instructor reopening/extending the simulation after this point (e.g., if running behind schedule), or is Day 5 close truly final?

**Recommendation:** make it a soft, reversible state ("completed," not a destructive action) — instructor should be able to un-pause/reopen if the class runs behind. Don't build one-way, unrecoverable "end simulation" logic.

## 8. Single Simulation Instance vs. Multi-Instance Support

05-product-requirements.md states this as a non-goal, but worth flagging explicitly: if this instructor wants to reuse the app for a future semester's cohort, does that mean spinning up a fresh deployment, or does the app need a concept of "simulation runs" so historical data from one cohort doesn't collide with a new one?

**Recommendation for the prototype:** single-instance is fine (matches the non-goal in 05). If reuse across semesters becomes a real need later, the cleanest retrofit is adding a `simulation_run_id` foreign key across the tables in 06-data-model.md — worth keeping that migration path in mind even if it's not built now, but not worth the complexity upfront.

## 9. Content Editing

Should the instructor be able to edit event text, decision-matrix weights, or regional profiles through the app UI, or is all of that fixed seed content for this prototype?

**Recommendation:** fixed seed content for the prototype (see 06-data-model.md notes). An instructor content-editing UI is a real feature for a "v2, actually deployed every semester" version of this tool, but out of scope for proving out the core mechanic.

## 10. Notification Delivery

05-product-requirements.md recommends in-app + optional email. Does "optional email" mean building real email sending (SMTP/service like Resend/Postmark), or is in-app-only acceptable for the prototype, with email as a stretch goal?

**Recommendation:** in-app only for the first working version. Email adds a real external dependency (sending service, deliverability, etc.) that isn't necessary to prove out the core simulation mechanics. Add it once the core loop works end-to-end.
