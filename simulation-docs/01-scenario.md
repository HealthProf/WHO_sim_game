# Scenario — Operation Veiled Horizon

## Summary

A novel betacoronavirus (provisional designation **NCoV-X1**) has emerged, first identified via a cluster of severe atypical pneumonia cases linked to a research campus in the SEARO region (South-East Asia). The simulation begins on **Day 14 post-index-case**, corresponding to the day the WHO Emergency Committee holds its first formal PHEIC assessment meeting.

The pathogen's origin is **deliberately ambiguous** — consistent with natural spillover but with genomic features some virologists call "unusual," and a host government that has been only partially cooperative with data requests. This ambiguity is a core pedagogical feature: it forces decision-making under real uncertainty and separates public health response from political attribution. **The app must never resolve this ambiguity — no hidden "true answer" should exist in the data model.**

## Pathogen Profile — NCoV-X1

| Parameter | Value |
|---|---|
| Family | Coronaviridae, genus Betacoronavirus, subgenus Sarbecovirus |
| Transmission | Respiratory droplet/aerosol (primary); fomite (secondary, lower efficiency) |
| Incubation period | 2–7 days (mean 4.5 days) |
| Serial interval | 4–6 days (mean 5 days) |
| Presymptomatic transmission | Confirmed; begins 1–2 days before symptom onset |
| Infectious period | ~6 days average (peaks Day 1–3 of symptoms) |
| **R0 (no intervention)** | **4.5** (95% CI 3.8–5.4) |
| **Overall CFR** | **2.1%** (95% CI 1.7–2.6%), highly age/comorbidity stratified |
| CFR in high-ICU-access settings | ~0.8% |
| CFR in low-capacity settings | ~4–6% |
| Hospitalization rate | 8% of symptomatic cases |
| ICU rate (of hospitalized) | 25% |
| Severity distribution | 60% mild, 30% moderate, 8% severe, 2% critical |
| Vaccine timeline | 8–14 months to EUA; candidate doses become available mid-simulation (Day 3) at 71% efficacy against severe disease |

## Elevated-Risk Populations (for equity-weighted scoring)

Adults 65+ (8.5x), immunocompromised (6.0x), chronic cardiopulmonary disease (4.5x), diabetes (3.8x), obesity (2.5x), pregnant women (2.2x), informal/outdoor workers (1.8x exposure), incarcerated populations (5.0x exposure), healthcare workers (elevated exposure).

## Simulation-Day Framing

The simulation runs 5 days (Monday–Friday), narratively representing the first ~30 days of the real-world outbreak response, compressed. Day-1 starting state:

- 128 confirmed cases globally, 6 deaths, true case count estimated 8–15x higher
- Human-to-human transmission confirmed in 3 countries across 2 regions (SEARO, WPRO)
- WHO DG has convened Emergency Committee under IHR Article 12 but has **not yet declared PHEIC** — this is the first decision event
- SEARO host government has requested WHO avoid the word "outbreak" publicly

## Disease Model — Simplified Compartmental Structure

This is intentionally simplified for educational responsiveness, not epidemiological precision. Use a discretized daily-step model per region.

**Compartments:** S (Susceptible) → E (Exposed) → I (Infectious) → H (Hospitalized) → R (Recovered) / D (Deceased)

**Core parameters:**
- Time step: 1 simulation day
- Mean incubation (E duration): 4.5 days
- Mean infectious period (I duration): 6 days
- Hospitalization rate: 8% of symptomatic, adjusted by regional capacity multiplier
- ICU rate: 25% of hospitalized
- Base CFR (full ICU access): 0.8%, adjusted upward by regional CFR multiplier below

**Regional CFR multipliers** (applied to base CFR to reflect healthcare capacity):

| Region | CFR Multiplier | Rationale |
|---|---|---|
| AFRO | 4.8× | Lowest ICU capacity |
| AMRO | 1.8× | Mixed capacity |
| EMRO | 2.6× | Variable; conflict-affected members increase this |
| EURO | 1.0× | Baseline / highest capacity |
| SEARO | 3.2× | Urban-rural divide; origin-region surveillance deficit |
| WPRO | 1.6× | Generally strong, high variance by member state |

**Regional population weight multipliers** (applied when aggregating regional outcomes into the global model):

| Region | Weight |
|---|---|
| AFRO | 1.20× |
| AMRO | 1.10× |
| EMRO | 1.10× |
| EURO | 0.90× |
| SEARO | 1.15× |
| WPRO | 1.00× |

**Detection rate:** Day-1 global average ~7% of true cases (surveillance deficit). Improves with data-sharing decisions; degrades with data-sharing failures. Each region has its own surveillance index (see 04-regions.md) which scales its individual detection rate.

## Decision → Model Impact (Transmission Weight System)

Every decision resolves to a consequence tier (see 02-decision-matrix.md), and each tier maps to a **transmission weight delta** applied to regional Rt, and/or a **CFR multiplier delta**, and/or a **capacity tier delta**. These deltas are cumulative across the simulation. Reference deltas by decision category:

| Category | Optimal Δ | Critical Failure Δ | Applies To |
|---|---|---|---|
| Travel & Border Restrictions | Rt −0.06 | Rt +0.12 | Regional Rt, propagates globally via population weight |
| Quarantine & Isolation | Rt −0.08 | Rt +0.14 | Regional Rt |
| NPIs | Rt −0.10 | Rt +0.15 | Regional Rt (largest single lever) |
| Surveillance & Data Sharing | Detection rate bonus | Detection rate −18% (global) | Global detection rate |
| Public Communication | Rt −0.08 (compliance effect) | Rt +0.18 | Regional Rt via compliance factor |
| Vaccine Distribution | CFR −0.10 | CFR +0.20 (under-served regions) | Regional CFR (not Rt) |
| International Aid & Funding | Capacity tier +1 | Capacity tier −1 | Regional CFR multiplier |

Exact per-tier deltas for every event are specified in 03-events.md under each event's `modelDelta` field — those are the authoritative numbers; the table above is the general pattern.

## Escalation States

The simulation has three global escalation states, which affect event frequency/intensity and should be visible on the dashboard:

| State | Trigger | Event Behavior |
|---|---|---|
| GREEN (Monitoring) | Global Rt < 2.5; no regional Critical Failure in prior 24h | 1–2 events/day, lower urgency |
| AMBER (Alert) | Global Rt 2.5–4.0; OR one regional Critical Failure in prior 24h | 2–3 events/day, increased urgency |
| RED (Emergency) | Global Rt > 4.0; OR 2+ regional Critical Failures; OR global CFR rising >3%/day | 3–4 events/day; DG emergency statement fires; mandatory inter-regional coordination event triggered |

## Narrative Arc by Day

| Day | Phase | Tone | Event Volume |
|---|---|---|---|
| 1 (Mon) | Orientation & First Crisis | Controlled urgency; PHEIC decision is the first real test | 2 events (light) |
| 2 (Tue) | Slow Escalation | Coordination tested for the first time; travel-ban conflict | 3–4 events (moderate) |
| 3 (Wed) | Peak Pressure | Most intense day; multiple simultaneous crises; vaccine equity crisis | 5–6 events (heavy) |
| 4 (Thu) | Consequence Reckoning | Teams see results of prior decisions; adaptive management required | 4–5 events (heavy) |
| 5 (Fri) | Resolution & Legacy | IHR reform decision, after-action report initiation | 3–4 events (moderate, reflective) |

## Day-1 Regional Starting Dashboard Values

| Region | Confirmed | Deaths | Est. True | Hosp. Capacity Used | Surveillance Index (1–10) | Local Transmission |
|---|---|---|---|---|---|---|
| AFRO | 3 | 0 | 30–45 | 28% | 2 (Low) | Not confirmed |
| AMRO | 8 | 0 | 80–120 | 61% | 8 (High) | Airport-linked only |
| EMRO | 5 | 1 | 50–75 | 44% | 5 (Medium) | Not confirmed |
| EURO | 22 | 1 | 180–300 | 72% | 9 (High) | Probable |
| SEARO | 84 | 4 | 700–1,300 | 52% | 3 (Low) | Confirmed, active |
| WPRO | 6 | 0 | 60–90 | 65% | 7 (High) | Airport-linked only |

Full resource envelopes (funds, PPE, antivirals, HCW surge capacity) are in 04-regions.md.
