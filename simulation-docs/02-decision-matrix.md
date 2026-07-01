# Decision Matrix — Scoring System

**This is the pedagogical core of the simulation. Preserve this faithfully — it is the mechanism that makes decisions "consequential" and equity-weighted.**

## Scoring Architecture

Every decision event that requires a team response is scored across three dimensions:

| Dimension | Weight | Measures |
|---|---|---|
| Evidence-Based Practice | 40% | Alignment with WHO/CDC guidelines and epidemiological literature |
| Political & Economic Realism | 30% | Implementation feasibility, stakeholder engagement, legal/political constraints |
| Health Equity | 30% | Impact on vulnerable populations and lower-resource regions |

Each dimension is scored 1–4 by the instructor (or, for structured-choice-only events, can be auto-scored — see note below). Composite score:

```
composite_percent = ((evidence_score * 0.4) + (political_score * 0.3) + (equity_score * 0.3)) / 4 * 100
```

## Consequence Tiers

| Tier | Composite Score | Score Shorthand |
|---|---|---|
| OPTIMAL | ≥ 85% | 4/4 |
| ADEQUATE | 65–84% | 3/4 |
| INADEQUATE | 40–64% | 2/4 |
| CRITICAL FAILURE | < 40% | 1/4 |

Tier assignment drives the model update (see 01-scenario.md § Decision → Model Impact, and the per-event `modelDelta` in 03-events.md).

**Facilitator action by tier:**
- OPTIMAL / ADEQUATE — no facilitator action required beyond logging
- INADEQUATE — consequence event dispatched to region automatically; facilitator monitors for escalation
- CRITICAL FAILURE — mandatory facilitator review; for the vaccine allocation event specifically, this also triggers a DG intervention narrative event

## Auto-Scoring vs. Manual Scoring

Structured-choice decisions (where a team picks option A/B/C/D) *can* be auto-scored, since each option has a pre-determined consequence tier baked into the event design (see each event's `consequences` block in 03-events.md — tiers map to specific option choices in most events).

Open-ended or hybrid decisions (written rationale, allocation numbers, free-text strategy) require **instructor judgment** against the three dimensions. The app should support both:
1. A structured-choice field that can trigger an auto-computed tier
2. An instructor-facing scoring interface (1–4 per dimension) for the written rationale component, which can override or supplement the auto-computed tier

Most events in this simulation are **hybrid** — a structured choice plus a required written rationale — so plan for the instructor-scoring workflow to be a core, frequently-used feature, not an edge case.

## The Seven Decision Categories

Every event belongs to one of these categories. Full tier-by-tier criteria for each category follow below.

1. Travel & Border Restrictions
2. Quarantine & Isolation Protocols
3. Vaccine & Therapeutic Distribution
4. Surveillance & Data Sharing
5. Non-Pharmaceutical Interventions (NPIs)
6. International Aid & Funding Requests
7. Public Communication & Risk Messaging

---

### 1. Travel & Border Restrictions

| Tier | Criteria |
|---|---|
| OPTIMAL | Risk-stratified measures proportional to transmission data; time-bound with sunset clause; exemptions for humanitarian/medical corridors and health workers; advance notice to affected states |
| ADEQUATE | Standard entry screening, targeted at highest-risk corridors; documented but may lack sunset clause or equity provisions |
| INADEQUATE | Blanket restrictions without epidemiological justification, OR significant implementation delay; disproportionately burdens low-income travelers/humanitarian ops without mitigation |
| CRITICAL FAILURE | No action despite clear evidence, OR measures that actively accelerate spread (e.g., forced mass movement) |

### 2. Quarantine & Isolation Protocols

| Tier | Criteria |
|---|---|
| OPTIMAL | Duration calibrated to incubation period; voluntary-compliance mechanisms; material support for isolated individuals; clear entry/exit criteria |
| ADEQUATE | Standard quarantine, reasonable duration; support provisions inconsistent; voluntary compliance primary mechanism |
| INADEQUATE | Duration misaligned with incubation period; no support provisions; inconsistent enforcement |
| CRITICAL FAILURE | No protocols despite community transmission, OR protocol design that concentrates cases (e.g., co-housing exposed and confirmed) |

### 3. Vaccine & Therapeutic Distribution

| Tier | Criteria |
|---|---|
| OPTIMAL | Prioritizes high-transmission AND high-vulnerability populations; addresses cold-chain feasibility in low-resource regions; explicit burden-sharing mechanism; all regions consulted; no region gets zero without agreement+compensation |
| ADEQUATE | Reasonable priority criteria but may over-weight politically/economically powerful regions; some equity provisions but not central |
| INADEQUATE | Allocation based on ability-to-pay/political relationships over need; high-burden low-resource regions systematically under-served |
| CRITICAL FAILURE | One or more regions receive zero allocation with no mitigation offered, OR doses allowed to expire due to distribution failure |

### 4. Surveillance & Data Sharing

| Tier | Criteria |
|---|---|
| OPTIMAL | Real-time sharing via coordinated platform; genomic data open within 24–72h; governance framework agreed by all parties; capacity-building support to weaker-surveillance regions |
| ADEQUATE | Shared with 24–48h delay; genomic data shared but not real-time; basic governance in place |
| INADEQUATE | Sharing delayed >72h, incomplete, or conditional on political negotiation; genomic data not shared internationally |
| CRITICAL FAILURE | Deliberate withholding, misrepresentation of case counts, or refusal to participate in coordination |

### 5. Non-Pharmaceutical Interventions (NPIs)

| Tier | Criteria |
|---|---|
| OPTIMAL | Layered bundle (4+ measures) proportional to current transmission; clear communication with defined review intervals; explicit equity provisions (mask access, economic support) |
| ADEQUATE | Reasonable bundle (2–3 measures); adequate communication; limited equity provisions |
| INADEQUATE | Too-late or too-early implementation; single-measure when layered response warranted; no equity provisions |
| CRITICAL FAILURE | No NPIs during active community transmission, OR actively counterproductive measures |

### 6. International Aid & Funding Requests

| Tier | Criteria |
|---|---|
| OPTIMAL | Need-based, evidence-justified requests/allocation; transparent accountability mechanism; proactive aid offers to lower-resource regions; no problematic conditionalities |
| ADEQUATE | Reasonable and mostly justified; accountability present but not detailed; allocation reasonably but not optimally equitable |
| INADEQUATE | Requested/allocated without clear justification; directed to politically-favored over highest-need recipients; impeding conditionalities |
| CRITICAL FAILURE | Refusal to engage with aid mechanisms during declared emergency, OR diversion of earmarked funds, OR bad-faith requests |

### 7. Public Communication & Risk Messaging

| Tier | Criteria |
|---|---|
| OPTIMAL | Timely (within 24h); transparent about uncertainty; culturally/linguistically adapted; delivered via trusted channels; actively counters misinformation; two-way feedback mechanisms |
| ADEQUATE | Timely and accurate but lacks cultural adaptation or equity provisions; one-directional broadcast only |
| INADEQUATE | Delayed >48h; factually inconsistent or uninformatively hedged; misinformation unaddressed; single-channel excluding population segments |
| CRITICAL FAILURE | Deliberate misinformation by regional authority, communication blackout during active outbreak, or messaging that discourages protective behavior |

## Global Model Weighting Reminder

When a regional consequence score is applied to the global model, multiply by the region's population weight (AFRO 1.20×, AMRO 1.10×, EMRO 1.10×, EURO 0.90×, SEARO 1.15×, WPRO 1.00×) — see 01-scenario.md for full context. This makes larger/higher-burden regions' decisions matter proportionally more to the global outcome, which is itself part of the equity design.
