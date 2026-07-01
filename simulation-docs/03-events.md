# Event Queue — Full Specification

16 events across 5 simulation days. 7 are **anchor events** (fixed timing, fire regardless of model state). 9 are **adaptive events** (timing and/or content vary based on model state or prior decisions).

## Chain & Trigger Quick Reference

```
EVT-001 (PHEIC) ──→ EVT-002 (SEARO data) ──→ EVT-006 (Vaccine tranche 1) ──┬→ EVT-007 (MSF letter)
                          │                                                  ├→ EVT-008 (AMRO bilateral)
                          └──→ EVT-003 (EURO travel ban)                    └→ EVT-012 (Vaccine tranche 2)
                                     │
EVT-004 (NPI decision) ──┬→ EVT-009 (NPI compliance collapse)
                          └→ [EVT-009-ALT if all regions scored Adequate+]
EVT-005 (HCW/PPE shortage) ──→ EVT-011 (AFRO healthcare surge)
EVT-002 ──→ EVT-010 (Misinformation surge) ──→ EVT-014 (Trajectory briefing)
EVT-007, EVT-009 ──→ EVT-013 (Political interference)
EVT-011, EVT-012 ──→ EVT-015 (IHR reform) ──→ EVT-016 (After-action close)
```

## Adaptive Trigger Rules (implement as server-side logic evaluated against model state)

| Condition | Response |
|---|---|
| Global Rt > 4.0 sustained 12h | Escalation → RED. Event frequency increases. DG emergency statement fires. |
| 2+ regions Critical Failure within 24h | Inter-regional cascade event triggered; coordination-failure consequence applied globally. |
| PHEIC delayed (EVT-001 option C/D) | EVT-003 fires 12h early. |
| SEARO withholds sequence (EVT-002 option C) | EVT-003 fires early; WPRO border-closure sub-event unlocked. |
| EVT-004 Inadequate in 2+ regions | EVT-009 fires (compliance collapse). Otherwise EVT-009-ALT (lower-stakes misinformation variant) fires instead. |
| EVT-006 Critical Failure | EVT-007 narrative switches to accusatory/public. Mandatory facilitator review. AFRO CFR to max tier. |
| AMRO bilateral deal disclosed (AMRO retained disproportionate share in EVT-006) | EVT-008 fires. SEARO–AMRO cooperation suspended. |
| Media Pressure Index > 65 | EVT-010 fires. |
| AFRO CFR multiplier > 3.5 at Day 4 | EVT-011 fires at max intensity (healthcare-collapse framing). Otherwise downgraded to routine resource review. |
| Any region's political tension index > 70 | EVT-013 fires targeting that region (SEARO nearly always qualifies; second target varies). |
| All regions Adequate+ on all events | Simulation stays GREEN; final events carry positive legacy framing. |

**Blackout window:** no event dispatch 10:00pm–6:00am America/Phoenix. Events scheduled inside this window hold and dispatch at 6:00am with an "overnight update" framing wrapper.

**Randomization:** events with a time range (e.g., "13:00–18:00 MST") should dispatch at a randomized time within that range — do not make timing predictable to students.

---

## Day 1 — Monday (2 anchor events)

### EVT-001 — PHEIC Declaration
- **Deadline:** HARD, 2-hour window. Non-response = recorded as abstaining, Inadequate tier.
- **Scope:** Global broadcast, all six teams
- **Category:** Surveillance & Data Sharing / Institutional Authority
- **Chain:** → EVT-002
- **Trigger:** Anchor, fires at simulation open (08:00 Day 1)
- **Narrative:** DG has convened Emergency Committee under IHR Article 12 following confirmed human-to-human transmission in 3 countries/2 regions. 128 confirmed cases, 6 deaths, true count 8-15x higher. SEARO host government wants WHO to avoid the word "outbreak."
- **Decision prompt:** Submit formal position on PHEIC declaration: (1) are Article 12 criteria met, (2) recommended declaration language, (3) position on SEARO's terminology request. Min 200-word rationale.
- **Structured options:** A) Declare PHEIC immediately, standard language — economics irrelevant to Article 12. B) Declare but with modified language acknowledging economic impact. C) Delay 48h for more data. D) Abstain pending member state consultation.
- **Consequences:** Optimal = A with evidence-based rationale (PHEIC declared, +legitimacy, SEARO pressure accelerates). Adequate = A or B reasonable (PHEIC declared, minor tension if B). Inadequate = C or D (PHEIC delayed 24h, global Rt +0.06, EURO starts unilateral measures early → triggers EVT-003 early). Critical = no response (loses Emergency Committee voice for Day 1).
- **Model delta:** PHEIC declared → detection rate +15% all regions. Delayed → EVT-003 fires 12h early.

### EVT-002 — SEARO Data-Sharing Standoff
- **Deadline:** SOFT, 4h window; reminder at 2h; auto-applies Option C consequence at 4h if no response.
- **Scope:** Regional (SEARO primary; WPRO, EURO secondary notification)
- **Category:** Surveillance & Data Sharing
- **Chain:** ← EVT-001; → EVT-006, EVT-010
- **Trigger:** Adaptive, fires 3h after EVT-001 resolves. Elevated urgency framing if EVT-001 was delayed.
- **Narrative:** SEARO's deposited genomic sequence is missing the spike protein RBD, citing "biosecurity concerns." WPRO states threaten 24h border closure without full data. EURO's chief scientific adviser calls redaction "scientifically indefensible."
- **Decision prompt:** SEARO responds to WHO's data request; WPRO/EURO submit formal position + any actions considered. Min 150-word rationale.
- **Structured options (SEARO):** A) Release full sequence immediately. B) Controlled release to WHO reference labs only (confidential). C) Refuse pending national review (~72h). D) Request WHO mediation first.
- **Consequences:** Optimal = A/B, sequence shared <24h (surveillance index +2, WPRO closure averted). Adequate = B with reasonable timeline, partial release <48h. Inadequate = C/D, withheld 72h (global detection rate down, WPRO closure triggers early, EURO files IHR complaint). Critical = no response (treated as C + DG public statement on non-compliance).
- **Model delta:** Full release → global detection +20%, vaccine timeline −1 day. Refusal → global detection −10% for 72h, WPRO Rt +0.08.

---

## Day 2 — Tuesday (3–4 events)

### EVT-003 — EURO Unilateral Travel Ban / IHR Article 43 Challenge
- **Deadline:** SOFT, 5h window; reminder at 3h; auto-applies Option A consequence at 5h.
- **Scope:** Multi-region (EURO primary, SEARO secondary, all teams notified)
- **Category:** Travel & Border Restrictions
- **Chain:** ← EVT-001; → EVT-008
- **Trigger:** Adaptive. Nominal: 08:00 Day 2. Early trigger (20:00 Day 1) if EVT-001 delayed or EVT-002 refused.
- **Narrative:** 3 EURO states impose blanket travel bans exceeding WHO guidance. SEARO files formal Article 43 protest. G7 Health Ministers publicly endorse the bans, contradicting WHO. MSF warns of medical supply chain disruption to SEARO.
- **Decision prompt:** EURO responds to Article 43 obligation + justifies measures. SEARO submits formal protest + any retaliatory/diplomatic response. Other teams state a position on whether WHO should publicly challenge EURO.
- **Structured options (EURO):** A) Full Article 43 notification with justification, maintain bans. B) Modify to risk-based screening per WHO guidance. C) Maintain bans, decline WHO notification (cites sovereignty).
- **Consequences:** Optimal = B (measures aligned with guidance, tension reduced, MSF concern resolved). Adequate = A (bans maintained but process respected). Inadequate = C (IHR violation, SEARO instability event, SEARO cooperation −1 tier, global Rt +0.04). Critical = non-response/active refusal (IHR compliance review, EURO loses 1 Emergency Committee vote-weight, diplomatic cascade).
- **Model delta:** Option B → SEARO Rt −0.03. Option C/non-response → SEARO Rt +0.06, AFRO Rt +0.03 (supply chain), global detection −5%.

### EVT-004 — NPI Decision (Regional)
- **Deadline:** SOFT, 6h window; reminder at 3h; auto Inadequate at 6h (treated as single-measure, no equity provisions).
- **Scope:** Regional — each of the six teams gets a version with region-specific Rt data
- **Category:** Non-Pharmaceutical Interventions
- **Chain:** → EVT-009 (or EVT-009-ALT)
- **Trigger:** Adaptive — fires when global Rt stays above 3.5 for 12+ hours, or automatically Day 2 afternoon if not yet triggered
- **Narrative:** WHO advisory requests NPI implementation plans within 8h. Region-specific Rt data included (SEARO 4.2, EURO 3.1, AFRO 1.8 [high uncertainty], AMRO 3.6, EMRO 2.9, WPRO 3.3). Containment window estimated 72–96h.
- **Decision prompt:** Submit NPI plan: (1) measures selected, (2) implementation timeline, (3) communication strategy, (4) equity provisions. Min 250-word rationale.
- **Menu (select all that apply):** mask mandate, physical distancing, venue capacity limits, school measures, workplace guidance, mass gathering restrictions, hand hygiene infrastructure, targeted high-risk-setting measures.
- **Consequences:** Optimal = layered bundle (4+) + equity provisions (Rt −15-25%). Adequate = moderate bundle (2–3) + some equity (Rt −8-14%). Inadequate = 1–2 measures, delayed, no equity (minimal impact, sets up EVT-009). Critical = no measures / counterproductive (Rt escalates, triggers healthcare surge on Day 3).
- **Model delta:** Applied per-region. SEARO/AMRO highest baseline Rt → largest absolute global impact from their NPI choices.

### EVT-005 — Healthcare Worker Exposure / PPE Shortage
- **Deadline:** SOFT, 5h window; reminder at 3h.
- **Scope:** Regional (SEARO primary, EMRO secondary)
- **Category:** International Aid & Funding / Healthcare Resource Allocation
- **Chain:** → EVT-011
- **Trigger:** Adaptive — fires when SEARO Rt > 3.8 AND SEARO PPE stock < 15 days, or automatically at 17:00 Day 2
- **Narrative:** SEARO reports 14+ confirmed HCW infections due to PPE shortage (linked to EURO travel-ban supply disruption). Whistleblower physician alleges concealment of true HCW infection numbers. EMRO has a parallel, less acute shortage.
- **Decision prompt:** SEARO submits emergency resource request. EMRO states position on sharing own limited stock. All others indicate contribution + any conditions.
- **Structured options:** A) Full solidarity — contribute 20% of regional PPE stock, no conditions. B) Conditional — 10% with accountability reporting. C) Decline contribution, offer technical/logistics support instead. D) No response.
- **Consequences:** Optimal = majority choose A/B (SEARO stabilized, HCW infections contained). Adequate = mixed response (partial stabilization). Inadequate = majority decline (SEARO HCW infections accelerate, triggers healthcare surge Day 3, whistleblower story becomes major misinformation event). Critical = no contributions + no communication response (SEARO capacity drops 1 tier, symptomatic staff work through illness).
- **Model delta:** Full solidarity → SEARO CFR multiplier −0.4. Majority decline → SEARO CFR multiplier +0.6. EMRO CFR multiplier adjusts proportionally to contribution received.

---

## Day 3 — Wednesday (5–6 events, peak pressure)

### EVT-006 — Early-Access Vaccine Allocation ("The Equity Crucible")
- **Deadline:** HARD, 4-hour window, no extension. Non-submitting region gets 0 doses. Allocations not summing to 180,000 get a 30-minute correction window before lock.
- **Scope:** Global, all six teams simultaneously
- **Category:** Vaccine & Therapeutic Distribution
- **Chain:** ← EVT-002; → EVT-007, EVT-008, EVT-012
- **Trigger:** Anchor, fires 08:00 Day 3 regardless of model state. **This is the simulation's central equity event.**
- **Narrative:** Pharma consortium releases 240,000 compassionate-use doses (71% efficacy vs. severe disease, Phase 2 data only). COVAX secures 180,000 for WHO allocation; remaining 60,000 pre-purchased bilaterally by AMRO's largest member state (not available for multilateral allocation). MSF publicly warns against politically-influenced allocation.
- **Decision prompt:** Each team submits proposed allocation of the 180,000 doses across all six regions (must sum to 180,000). Justify against all three scoring dimensions. Inter-regional negotiation permitted/encouraged during the window.
- **Framework options teams may cite/combine:** proportional to confirmed cases; proportional to est. true cases; proportional to CFR multiplier (need-based); proportional to at-risk HCW population; equal allocation; Rt-based prioritization; COVAX equity framework (prioritize AFRO/SEARO/EMRO).
- **Consequences:** Optimal = prioritizes AFRO/SEARO by CFR multiplier + HCW need (global CFR trajectory −10-15%, MSF positive statement). Adequate = partial equity orientation (moderate CFR improvement). Inadequate = allocation reflects political/economic weight over need (AFRO/SEARO under-served, AFRO CFR event fires Day 4, MSF formal protest accelerates EVT-007). Critical = AFRO gets ~zero with no justification (equity collapse event, AFRO CFR to max tier, DG emergency statement, **mandatory facilitator review**).
- **Model delta:** Optimal COVAX-aligned → AFRO CFR multiplier −0.8, SEARO −0.5. Needs-blind allocation → AFRO CFR multiplier +1.2 (single largest model impact in the simulation).
- **Implementation note:** collect and display the aggregate of all six teams' allocations vs. a needs-based benchmark — this comparison is a key pedagogical artifact and should be a visible dashboard/report feature, not just backend data.

### EVT-007 — MSF Open Letter
- **Deadline:** SOFT, 3h window for a joint response; if no agreement, each region submits independently (counts as Option D + coordination-failure penalty).
- **Scope:** Global — requires coordinated response across all six teams
- **Category:** Public Communication & Risk Messaging
- **Chain:** ← EVT-006; → EVT-013
- **Trigger:** Adaptive, fires 2h after EVT-006 resolves. **Content branches on EVT-006 outcome:** if Optimal, MSF statement is positive/commendatory; if Inadequate/Critical, MSF publishes an accusatory open letter ("WHO's Vaccine Apartheid") that goes viral (47+ outlets in 90 min), Media Pressure Index spikes to its simulation peak.
- **Decision prompt:** Teams must agree on ONE joint WHO response within 3 hours (inter-regional coordination required). If no agreement, independent responses count as coordination failure.
- **Structured options:** A) Joint acknowledgment — accept equity shortfall, commit to revised framework for next tranche. B) Joint rebuttal — defend allocation, reject characterization. C) Partial acknowledgment. D) No joint response (independent).
- **Consequences:** Optimal = A with specific corrective commitments (Media Pressure Index drops, sets up better EVT-012). Adequate = C (index stabilizes). Inadequate = B without compelling evidence (media intensifies, NPI compliance drops in 2 regions). Critical = D / no response (coordination failure, media crisis Day 4, conflicting independent statements → credibility event).
- **Model delta:** Option A → global NPI compliance +8%. Option D/non-response → global Rt +0.08.

### EVT-008 — AMRO Vaccine Nationalism Disclosure
- **Deadline:** SOFT, 4h window; non-response triggers formal WHO investigation + AMRO loses Emergency Committee participation for 1 day.
- **Scope:** Multi-region (AMRO primary, all notified)
- **Category:** Vaccine & Therapeutic Distribution / International Aid
- **Chain:** ← EVT-003; → EVT-012
- **Trigger:** Adaptive — fires if AMRO's EVT-006 allocation disproportionately retained doses for itself, or automatically 13:00 Day 3
- **Narrative:** Leaked document reveals AMRO's largest member state's separate 200,000-dose bilateral deal signed same day as COVAX negotiation. Journalist frames as "double-dipping." AFRO calls for WHO investigation. SEARO suspends bilateral cooperation with that member state.
- **Decision prompt:** AMRO addresses disclosure — was it disclosed to WHO, does it violate agreements, corrective action? Other teams state position/recommended WHO action.
- **Structured options:** A) Acknowledge, commit to sharing a portion via COVAX. B) Defend as sovereign right, offer transparency. C) Dispute characterization, request WHO fact-finding. D) No response pending legal review.
- **Consequences:** Optimal = A with meaningful dose contribution (trust partially restored, global CFR improves). Adequate = B/C with transparency commitment (tension managed, no additional doses). Inadequate = B without transparency, or D (AFRO/SEARO formally withdraw bilateral cooperation with that member state, global coordination penalty). Critical = non-response/misrepresentation (formal WHO investigation, AMRO isolated from inter-regional coordination for rest of Day 3).
- **Model delta:** Option A with sharing → global CFR −0.06. Option C/D → coordination efficiency −15% for 24h.

### EVT-009 — Public Trust Crisis / NPI Compliance Collapse
- **Deadline:** SOFT, 5h window; non-response = gathering proceeds unmitigated (super-spreader event fires).
- **Scope:** Multi-region — targets regions that scored Inadequate/Critical on EVT-004 (typically 2–3 teams)
- **Category:** Public Communication & Risk Messaging / NPIs
- **Chain:** ← EVT-004; → EVT-013
- **Trigger:** Adaptive — fires only if 2+ regions scored Inadequate/Critical on EVT-004. **If not, EVT-009-ALT fires instead** (lower-stakes misinformation-only variant, no super-spreader mechanic).
- **Narrative:** NPI compliance has fallen below 40% in affected region(s): inconsistent government messaging, viral "NPIs are theatre" social campaign, visible non-compliance by a head of government. Rt +0.3 in 24h. An 80,000-person religious gathering is scheduled in 72h; organizers refuse to cancel.
- **Decision prompt:** Emergency communication + enforcement strategy addressing: misinformation response, gathering recommendation, revised NPI package. Min 300 words. **This is a sequential/chain event** — prior NPI equity provisions (from EVT-004) affect available community trust/options.
- **Structured options (re: gathering):** A) Recommend cancellation + community engagement + livestream alternative. B) Recommend modification (capacity limit, outdoor, mask requirement). C) Permit with enhanced entry screening. D) No recommendation, defer to member state.
- **Consequences:** Optimal = A with robust engagement (compliance partially restored, Rt increase contained). Adequate = B (compliance stabilizes, gathering proceeds with partial mitigation). Inadequate = C/D (super-spreader event, regional Rt +0.4 for 48h). Critical = non-response (super-spreader at max intensity, healthcare surge accelerated, mandatory facilitator escalation).
- **Model delta:** Option A → regional Rt −0.2. Super-spreader (C/D/non-response) → regional Rt +0.4 for 48h then +0.15 persistent.

### EVT-010 — Misinformation Surge (Lab-Origin Conspiracy)
- **Deadline:** SOFT, 4h window; non-response → misinformation continues, Media Pressure Index +20, NPI compliance drops further in 2 most-affected regions.
- **Scope:** Global, all six teams
- **Category:** Public Communication & Risk Messaging
- **Chain:** ← EVT-002; → EVT-014
- **Trigger:** Adaptive — fires when Media Pressure Index > 65, or automatically 18:00 Day 3
- **Narrative:** Viral social thread (28M followers) alleges NCoV-X1 is a deliberately-released "weaponized bioagent," citing the EVT-002 sequence redaction as "proof." 4.2M shares in 6h. Non-reviewed preprint cited as "scientific evidence." SEARO Regional Director is overwhelmed with media requests.
- **Decision prompt:** Coordinated misinformation response strategy: public statement on bioweapon claims, engagement with the preprint, recommended government messaging, specific support to SEARO. SEARO submits a separate region-specific statement.
- **Structured options:** A) Proactive — strong rebuttal with specific evidence, direct engagement with preprint authors/journal editors. B) Measured — acknowledge concern, note investigation ongoing, don't directly address allegations. C) Reactive — respond only to direct media inquiries. D) Escalate — request UN Security Council discussion (over-escalation).
- **Consequences:** Optimal = A (spread slowed, Media Pressure Index −15, SEARO cooperation improves). Adequate = B (slows but doesn't stop, index neutral). Inadequate = C (accelerates, index +10, compliance drops in 2 regions). Critical = D or non-response (crisis escalates, index +25, WHO credibility event, SEARO operational capacity reduced).
- **Model delta:** Option A → NPI compliance +5% globally. Non-response → NPI compliance −8% in the two highest-media-pressure regions, Rt +0.06.
- **Implementation note:** the app should never resolve the actual origin question. If a team asks directly, the correct in-character DG response is: "The investigation is ongoing. All hypotheses remain open." This is intentional epistemic humility, not a placeholder to be filled in later.

---

## Day 4 — Thursday (4–5 events, consequence reckoning)

### EVT-011 — AFRO Healthcare Surge / HCW Deployment Request
- **Deadline:** HARD, 3-hour window. Non-response = recorded as Option D (decline).
- **Scope:** Multi-region (AFRO primary, all others receive resource request)
- **Category:** International Aid & Funding / Healthcare Resource Allocation
- **Chain:** ← EVT-005; → EVT-015
- **Trigger:** Adaptive — fires 08:00 Day 4 if AFRO CFR multiplier > 3.5 (i.e., EVT-006 was inadequate) or AFRO PPE stock < 10 days. If AFRO performing well, downgrades to a routine resource review (no crisis framing).
- **Narrative:** AFRO healthcare system saturation — bed occupancy >95% in two member states, zero reserve HCW capacity. Joint ministerial emergency declaration requesting international HCW deployment. EURO has highest surplus but own surge pressure; AMRO/WPRO moderate surplus.
- **Decision prompt:** All teams except AFRO specify deployment numbers, duration, conditions, own-capacity impact management. AFRO specifies where HCWs are most needed + support infrastructure available.
- **Structured options:** A) Full deployment — 15% of surplus HCW capacity, 7-day rotation. B) Partial — 7%, 5-day rotation. C) Financial contribution only (fund third-party recruitment). D) Decline — surge risk too high.
- **Consequences:** Optimal = majority choose A/B (AFRO stabilized, CFR multiplier reduced, donor regions +3% occupancy). Adequate = mixed response (partial stabilization). Inadequate = majority decline (AFRO CFR multiplier to max, excess mortality event, AFRO operational capacity reduced Day 5). Critical = all decline (AFRO healthcare collapse event, mortality to simulation maximum, mandatory DG emergency statement — **most significant equity failure event possible in the simulation**).
- **Model delta:** Full solidarity → AFRO CFR multiplier −1.2. Majority decline → AFRO CFR multiplier +1.5. Donor regions: +3% occupancy per contributing region.
- **Implementation note:** if AFRO healthcare collapse triggers, do not soften subsequent narrative language — this is meant to be the simulation's most emotionally significant moment and a key after-action-report artifact.

### EVT-012 — Second Vaccine Tranche (Revised Allocation)
- **Deadline:** SOFT, 5h window; reminder at 3h; non-submitting regions get 0 doses.
- **Scope:** Global, all six teams
- **Category:** Vaccine & Therapeutic Distribution
- **Chain:** ← EVT-006, EVT-008; → EVT-015
- **Trigger:** Adaptive — fires 4h after EVT-011 resolves. **Dose pool varies by prior decisions:** 280,000 if AMRO contributed bilateral doses (EVT-008 option A); 220,000 standard; 160,000 if EVT-006 was Critical Failure (consortium withholds doses citing "distribution concerns").
- **Narrative:** Second COVAX tranche released. Teams now have 3 days of visible model consequences from their EVT-006 decision to inform this one.
- **Decision prompt:** Same allocation-framework structure as EVT-006, but rationale must specifically address: (1) how this corrects/reinforces the EVT-006 decision, (2) what dashboard data is being used to justify the framework, (3) any cross-team coordination undertaken before submitting.
- **Consequences:** Optimal = improves on EVT-006 equity orientation, demonstrates adaptive management. Adequate = modest improvement. Inadequate = repeats EVT-006's pattern despite adverse evidence (no adaptation demonstrated — key debrief artifact). Critical = allocation worse than EVT-006 (rare; most important debrief case if it happens).
- **Model delta:** Same framework as EVT-006 but with a 1.3× amplification factor (interacts with existing partial immunity in the modeled population).
- **Implementation note:** the app should make the EVT-006-vs-EVT-012 comparison a first-class visible artifact (e.g., a side-by-side report), not just two rows in a database — this comparison is one of the richest pedagogical outputs of the whole simulation.

### EVT-013 — Political Interference / Member State Demands
- **Deadline:** SOFT, 5h window; non-response treated as Option D (escalate to DG/Emergency Committee), consequences delayed 24h.
- **Scope:** Regional — targets 1–2 teams adaptively based on political tension index (SEARO nearly always qualifies)
- **Category:** Institutional Authority / Public Communication
- **Chain:** ← EVT-007, EVT-009; → EVT-016
- **Trigger:** Adaptive — fires when any region's political tension index > 70 (driven by prior PHEIC/travel-ban/vaccine-allocation decisions)
- **Narrative (region-dependent variants):**
  - **SEARO variant:** host government demands pre-approval rights over all WHO public communications regarding NCoV-X1, threatens to expel WHO country office.
  - **EURO variant:** 3 member states demand WHO endorse their travel-ban measures or lose €340M annual contribution.
  - **AMRO variant:** largest member state demands WHO publicly refute the bilateral-deal story or lose Emergency Fund contribution.
- **Decision prompt:** Formal response addressing: accommodate/partially accommodate/reject; legal/normative basis; what (if anything) to communicate publicly.
- **Structured options:** A) Reject, citing WHO's constitutional independence; accept threatened consequences. B) Negotiate modified accommodation preserving independence in principle. C) Accommodate to preserve relationship/funding. D) Escalate to DG/Emergency Committee without a regional decision.
- **Consequences:** Optimal = A, principled and well-articulated (short-term cost, but WHO credibility preserved globally; other teams express support). Adequate = B (tension managed, no major credibility event). Inadequate = C (WHO independence compromised; regional public communications become subject to member-state filter — creates an information-distortion effect for the rest of the simulation). Critical = non-response/capitulation without negotiation (member state effectively controls WHO messaging in-region, credibility collapse, mandatory DG intervention).
- **Model delta:** Option A → short-term political tension only, no direct model impact. Option C → information quality in affected region −30% for remainder of simulation (communications filtered).

---

## Day 5 — Friday (3–4 events, resolution & legacy)

### EVT-014 — Outbreak Trajectory Briefing
- **Deadline:** NONE — information event, no decision required
- **Scope:** Global, all six teams
- **Category:** Surveillance & Data Sharing
- **Chain:** ← EVT-010; → EVT-015
- **Trigger:** Anchor, fires 08:00 Day 5 automatically
- **Narrative/Purpose:** Comprehensive 30-day trajectory assessment based on the week's decisions. Each team receives their regional dashboard summary (Rt, CFR, capacity, 30-day projection). Global summary visible to all teams simultaneously.
- **Implementation note:** this is the moment consequences become fully legible — build this as a dedicated "week in review" report/dashboard state, ideally with a personalized per-team summary of their 3 strongest and 3 weakest decisions (structured around the three scoring dimensions). This directly sets up EVT-015 and the after-action report.

### EVT-015 — IHR Reform Proposal (Legacy Decision)
- **Deadline:** SOFT, 4h window; non-submitting teams get Inadequate for the after-action record. Extension possible at facilitator discretion if active cross-team coordination is underway.
- **Scope:** Global, collaborative — joint multi-region proposals carry more narrative weight
- **Category:** Surveillance & Data Sharing / Institutional Authority
- **Chain:** ← EVT-011, EVT-012, EVT-014; → EVT-016
- **Trigger:** Adaptive, fires 30 minutes after EVT-014 delivery is confirmed
- **Decision prompt (min 400 words):** (1) identify 2 most significant IHR gaps revealed this week, (2) specify supported amendments and why, (3) address sovereignty interaction, (4) reflect on at least one of the team's own decisions this week that the proposed reform would have prevented or improved.
- **Structured options:** A) Enforcement package — stronger IHR compliance mechanisms, financial penalties for non-reporting. B) Equity package — enshrine health equity in IHR Article 2, mandatory COVAX-equivalent mechanism for future emergencies. C) Transparency package — mandatory real-time data sharing with independent verification. D) Custom — team-proposed framework.
- **Consequences:** Optimal = thoughtful, evidence-based, connects to the team's own decisions (demonstrates systems thinking/adaptive management — strong after-action anchor). Adequate = reasonable but somewhat generic. Inadequate = generic/templated, no connection to specific decisions made. Critical = non-submission, or a proposal that contradicts the team's own decisions with no self-awareness.
- **Model delta:** None — this decision affects the narrative/legacy record only, not the live model.

### EVT-016 — After-Action Report Initiation (Administrative Close)
- **Deadline:** NONE
- **Scope:** Global
- **Category:** Administrative close
- **Chain:** ← EVT-015; terminal event
- **Trigger:** Anchor, fires 14:00 Day 5 regardless of EVT-015 status
- **Purpose:** Simulation officially concludes. DG thanks all teams. After-action report template/instructions distributed. Simulation model state freezes and is captured for the debrief.
- **Implementation note:** before this fires, the app should compile a final debrief package: global Rt trajectory across all 5 days, regional CFR actual-vs-optimal comparison, EVT-006 vs EVT-012 allocation comparison, a coordination success/failure map, and the 3 most consequential individual decisions of the week (by model-impact magnitude). These should be instructor-facing exportable artifacts, not just raw log data.
