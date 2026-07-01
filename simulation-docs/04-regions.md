# Regional Profiles

Six teams, each representing a WHO regional office. All teams are collaborative (same institution, shared crisis), not competitive. Each team should see **only their own profile in full**; the Global Situation Summary below is shared with all teams at simulation start.

## Global Situation Summary (shared with all teams)

A novel betacoronavirus (NCoV-X1) has been identified following a severe pneumonia cluster at a research campus in SEARO. Human-to-human transmission confirmed in 3 countries/2 regions. WHO DG has convened the Emergency Committee under IHR Article 12; PHEIC not yet declared. Day 14 post-index-case.

| Region | Confirmed | Deaths | Est. True | Hosp. Cap. Used | Surveillance | Transmission Status |
|---|---|---|---|---|---|---|
| AFRO | 3 | 0 | 30–45 | 28% | Low | Not confirmed |
| AMRO | 8 | 0 | 80–120 | 61% | High | Airport-linked |
| EMRO | 5 | 1 | 50–75 | 44% | Medium | Not confirmed |
| EURO | 22 | 1 | 180–300 | 72% | High | Probable |
| SEARO | 84 | 4 | 700–1,300 | 52% | Low | Confirmed, active |
| WPRO | 6 | 0 | 60–90 | 65% | High | Airport-linked |

Pathogen facts available to all teams: R0 4.5, incubation 2–7 days, presymptomatic transmission confirmed, overall CFR ~2.1% (ranging 0.8%–5–6% by healthcare capacity), no population immunity, vaccine 8–14 months out. Origin under investigation (natural spillover vs. lab-adjacent — undetermined).

Open questions facing WHO at simulation start: PHEIC declaration, SEARO genomic sequence completeness, EURO travel-ban response, NPI recommendations across regions with different Rt, future vaccine equity framework.

**Design note:** this asymmetry of information (all teams see the shared summary; each team additionally sees only their own detailed profile) is intentional and should be enforced at the data-access layer, not just the UI layer.

---

## AFRO — WHO Regional Office for Africa

- **Role title:** WHO Regional Director for Africa
- **HQ:** Brazzaville, Republic of Congo
- **Member states:** 47, Sub-Saharan Africa
- **Population represented:** 1.1 billion (~14% global)

**Starting epidemiology:** 3 confirmed / 0 deaths / est. true 30–45 / 28% hospital capacity used / surveillance index 2 (Low) / no confirmed local transmission / estimated Rt 1.4 (high uncertainty — true Rt likely higher given surveillance gaps).

**Starting resources:** Emergency fund $12M / PPE stock 18 days / antivirals 4,000 doses / HCW surge capacity very limited (+5%) / CFR multiplier 4.8× / population weight 1.20×.

**Key constraint:** Most dependent on international aid of any region. Supply chains for PPE/pharmaceuticals run through SEARO and EURO — both currently disrupted.

**Geopolitical context:** Historical perception that AFRO's needs are acknowledged but under-prioritized when global resources are scarce (COVID-19 vaccine equity failures are a recent, live memory for member-state health ministers). Strong relationship with Africa CDC for surveillance support. Three member states are experiencing active conflict/humanitarian crisis, which will complicate any response if transmission reaches those populations.

**Strategic priorities:** advocate early and loudly for needs-based vaccine allocation (CFR data makes the case); build technical-support relationships with WPRO/EURO (strongest surveillance); leverage Africa CDC; prepare for outbreak arrival before international support mobilizes.

**Unique challenge:** most to lose from poor global decisions, least structural power to prevent them. Primary tool is moral authority + evidence, used consistently.

---

## AMRO — WHO Regional Office for the Americas (PAHO)

- **Role title:** WHO/PAHO Regional Director for the Americas
- **HQ:** Washington D.C., United States
- **Member states:** 35, North/Central/South America + Caribbean
- **Population represented:** 1.0 billion (~13% global)

**Starting epidemiology:** 8 confirmed / 0 deaths / est. true 80–120 / 61% hospital capacity used / surveillance index 8 (High) / no confirmed community transmission (airport-linked only) / estimated Rt 3.1 in highest-risk urban corridors.

**Starting resources:** Emergency fund $85M / PPE stock 45 days / antivirals 28,000 doses / HCW surge capacity moderate (+25%) / CFR multiplier 1.8× / population weight 1.10×.

**Key constraint:** Vaccine-nationalism pressure from largest member state, which has independently negotiated a bilateral pharmaceutical deal that may conflict with COVAX allocation obligations. AMRO team did not authorize this but is its regional custodian.

**Geopolitical context:** Largest member state has significant leverage over global pharmaceutical supply. AMRO has the strongest NPI implementation capacity of any region (high surveillance, high resources, surge capacity) — meaning delayed early action here is a political choice, not a resource constraint.

**Strategic priorities:** get ahead of the bilateral-deal story proactively; implement strong early NPIs; build solidarity credibility with AFRO/SEARO early; be explicit about the tension between member-state interests and WHO mandate rather than pretending it doesn't exist.

**Unique challenge:** the region most capable of leading by example and most tempted to lead by self-interest.

---

## EMRO — WHO Regional Office for the Eastern Mediterranean

- **Role title:** WHO Regional Director for the Eastern Mediterranean
- **HQ:** Cairo, Egypt
- **Member states:** 22, Middle East / North Africa / parts of Central Asia
- **Population represented:** 679 million (~9% global)

**Starting epidemiology:** 5 confirmed / 1 death (elderly traveler — early severity signal) / est. true 50–75 / 44% hospital capacity used / surveillance index 5 (Medium) / no confirmed local transmission / estimated Rt 2.6 in highest-exposure corridors.

**Starting resources:** Emergency fund $34M / PPE stock 30 days / antivirals 12,000 doses / HCW surge capacity limited (+12%) / CFR multiplier 2.6× / population weight 1.10×.

**Key constraint:** Conflict-affected member states consume disproportionate resources and have near-zero capacity to implement NPIs or quarantine.

**Geopolitical context:** Enormous internal diversity — from high-income Gulf states with world-class hospitals to member states with collapsed health systems. Five member states experiencing active conflict/severe humanitarian crisis. Highest global diabetes burden, elevating severity risk. Partial PPE/pharma supply dependency on SEARO manufacturers, directly affected by the EURO travel-ban dispute.

**Strategic priorities:** explicitly triage member states by capacity; use diabetes burden data to argue for comorbid-population vaccine priority; engage the EURO-SEARO travel dispute early (direct material interest); maintain WHO operational presence in conflict zones despite pressure to withdraw.

**Unique challenge:** managing a region containing both some of the world's most capable and most fragile health systems simultaneously — generic WHO guidance won't fit; contextualization is the core contribution.

---

## EURO — WHO Regional Office for Europe

- **Role title:** WHO Regional Director for Europe
- **HQ:** Copenhagen, Denmark
- **Member states:** 53, Europe + Central Asia
- **Population represented:** 930 million (~12% global)

**Starting epidemiology:** 22 confirmed / 1 death / est. true 180–300 (largest confirmed cluster outside SEARO) / 72% hospital capacity used / surveillance index 9 (High) / probable local transmission (cluster size/distribution suggests undetected chains) / estimated Rt 3.1 with deceleration signal following early measures.

**Starting resources:** Emergency fund $210M / PPE stock 60 days / antivirals 55,000 doses / HCW surge capacity high (+40%) / CFR multiplier 1.0× (baseline) / population weight 0.90×.

**Key constraint:** Political pressure from major member states to act unilaterally/visibly, even against WHO guidance. Three member states have already implemented travel bans exceeding WHO guidance — EURO team did not authorize this but must manage the consequences.

**Geopolitical context:** Member states include WHO's largest financial contributors, some of whom have signaled continued funding is contingent on WHO aligning with their national policies (endorsing travel bans, demanding an independent origin investigation). No clean resolution exists to the funding-vs-independence tension. High surveillance makes EURO the de facto early-information leader of the simulation.

**Strategic priorities:** address the travel-ban situation immediately on WHO's terms; use surveillance advantage to inform lower-surveillance regions (especially AFRO); resist using resource advantage as a shield against equity obligations; document every funding-leverage pressure attempt for the after-action record.

**Unique challenge:** most capable of unilaterally improving global outcomes, most tempted to prioritize member-state politics over WHO's mandate. The simulation is designed so accommodating political pressure produces worse outcomes than resisting it.

---

## SEARO — WHO Regional Office for South-East Asia

- **Role title:** WHO Regional Director for South-East Asia
- **HQ:** New Delhi, India
- **Member states:** 11 (India, Indonesia, Thailand, Bangladesh, Nepal, Sri Lanka, and others)
- **Population represented:** 2.0 billion (~26% global)

**Note: SEARO carries more detail than other regions by design** — this team is in the most epidemiologically and geopolitically complex position and needs the most scaffolding.

**Starting epidemiology:** 84 confirmed / 4 deaths / est. true 700–1,300 (highest of any region, 8–15x confirmed) / 52% hospital capacity used / surveillance index 3 (Low) / confirmed active community transmission in 3+ member states / estimated Rt 4.2 with active growth — **the highest Rt of any region**.

**Starting resources:** Emergency fund $28M / PPE stock 22 days / antivirals 8,000 doses / HCW surge capacity limited (+15%) / CFR multiplier 3.2× / population weight 1.15×.

**Key constraint:** Political sensitivity limits decision speed. The host government's data-sharing posture directly constrains SEARO's ability to give WHO HQ what it needs to coordinate globally.

**Geopolitical context — the outbreak origin problem:** the SEARO host government maintains the outbreak was natural spillover and has refused independent investigation of the research facility at the epicenter. This is contested by independent virologists and several member states. SEARO must navigate without prejudging an unconcluded investigation, while not letting political pressure compromise scientific credibility or IHR obligations. The genomic-sequence-sharing decision (EVT-002) is in SEARO's hands and the rest of the world is watching it.

**Host government dynamics (sensitive/confidential-flavor context):** the host government will cooperate on clinical data but treats genomic sequence data as a national biosecurity matter; has requested WHO avoid the word "outbreak" publicly; has signaled that WHO's country-office presence depends on "appropriate sensitivity" to national interests — but has NOT asked SEARO to misrepresent the epidemiological situation, only to use "careful language." The line between diplomatic care and misinformation is one SEARO must hold clearly.

**Understanding the surveillance deficit:** SEARO's surveillance index (3/10) means the confirmed case count (84) is almost certainly a severe undercount — WHO modeling estimates true cases at 700–1,300. Practical implications: (1) the Rt estimate of 4.2 may itself be an underestimate if surveillance only captures severe cases; (2) NPI decisions need to target the estimated true situation, not the confirmed count, or SEARO will always be responding weeks behind the actual curve; (3) improving the surveillance index (via data-sharing agreements, technical support from WPRO/EURO, testing capacity investment) is one of the highest-return actions available. Requesting technical surveillance support from WPRO/EURO in an early inter-regional message, and committing to full data sharing with WHO reference labs, both improve SEARO's own situational awareness and build urgently-needed inter-regional trust.

**Strategic priorities:** resolve the genomic sequence dispute in WHO's favor quickly; implement the most aggressive NPI package member states will accept (highest Rt in the simulation); formally engage the EURO travel-ban dispute (legitimate IHR complaint + supply-chain grievance); communicate transparently about what is/isn't known; protect WHO operational independence in-country.

**Unique challenge:** managing an active outbreak with a surveillance deficit while under geopolitical siege — every decision second-guessed by other regions. Strongest asset: consistent, transparent, evidence-grounded communication even when uncomfortable for the host government.

---

## WPRO — WHO Regional Office for the Western Pacific

- **Role title:** WHO Regional Director for the Western Pacific
- **HQ:** Manila, Philippines
- **Member states:** 37 (China, Japan, Australia, South Korea, Philippines, Vietnam, Pacific Island nations, etc.)
- **Population represented:** 1.9 billion (~25% global)

**Starting epidemiology:** 6 confirmed / 0 deaths / est. true 60–90 / 65% hospital capacity used / surveillance index 7 (High) / no confirmed local transmission (airport-linked only) / estimated Rt 3.3 in high-transit corridors.

**Starting resources:** Emergency fund $96M / PPE stock 50 days / antivirals 32,000 doses / HCW surge capacity moderate (+30%) / CFR multiplier 1.6× / population weight 1.00× (baseline reference).

**Key constraint:** Island-nation members face supply chain vulnerabilities and cannot easily receive international HCW support. Regional strength is very unevenly distributed.

**Geopolitical context:** WPRO's transit hubs are the primary pathway through which NCoV-X1 exits SEARO and reaches other regions, giving WPRO significant leverage in the data-sharing dispute — leverage that should be used constructively, not punitively. Three member states threaten border closures without full SEARO sequence data within 24h. Strong surveillance makes WPRO a natural information-sharing partner for AFRO/EMRO.

**Strategic priorities:** manage member-state travel-restriction pressure as leverage for SEARO data-sharing rather than punishment; implement early NPIs at transit hubs (highest-exposure settings); provide surveillance technical support to AFRO/EMRO; develop a specific plan for Pacific Island members with near-zero surge capacity.

**Unique challenge:** sits at the geographic/operational intersection of the outbreak origin and the rest of the world. How WPRO manages the SEARO relationship (pressure without punishment) determines whether the global information environment improves or deteriorates in the first 48 hours.

---

## Cross-Region Data Table (for quick reference / seeding the database)

| Region | Fund | PPE Days | Antivirals | HCW Surge | Surveillance | CFR Mult. | Pop. Weight | Political Tension (start) | Public Trust (start) |
|---|---|---|---|---|---|---|---|---|---|
| AFRO | $12M | 18 | 4,000 | +5% | 2 | 4.8× | 1.20× | 20 | 60 |
| AMRO | $85M | 45 | 28,000 | +25% | 8 | 1.8× | 1.10× | 30 | 65 |
| EMRO | $34M | 30 | 12,000 | +12% | 5 | 2.6× | 1.10× | 35 | 55 |
| EURO | $210M | 60 | 55,000 | +40% | 9 | 1.0× | 0.90× | 40 | 70 |
| SEARO | $28M | 22 | 8,000 | +15% | 3 | 3.2× | 1.15× | 70 | 45 |
| WPRO | $96M | 50 | 32,000 | +30% | 7 | 1.6× | 1.00× | 25 | 65 |

Political Tension and Public Trust indices (0–100 scale) are referenced by adaptive event triggers in 03-events.md (e.g., EVT-013 fires when tension > 70) and should be tracked as live, mutable model state, not static profile data.
