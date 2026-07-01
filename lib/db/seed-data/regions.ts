export const regionSeed = [
  {
    id: "AFRO",
    fullName: "WHO Regional Office for Africa",
    roleTitle: "WHO Regional Director for Africa",
    hqLocation: "Brazzaville, Republic of Congo",
    memberStatesDesc: "47 member states, Sub-Saharan Africa",
    populationDesc: "1.1 billion (~14% global)",
    startingFund: 12_000_000,
    startingPpeDays: 18,
    startingAntivirals: 4000,
    startingHcwSurgePct: 5,
    startingSurveillanceIndex: 2,
    startingCfrMultiplier: 4.8,
    populationWeight: 1.2,
    startingPoliticalTension: 20,
    startingPublicTrust: 60,
    startingConfirmed: 3,
    startingDeaths: 0,
    startingEstTrueLow: 30,
    startingEstTrueHigh: 45,
    startingHospCapacityPct: 28,
    startingRt: 1.4,
    profileMarkdown: `**Key constraint:** Most dependent on international aid of any region. Supply chains for PPE/pharmaceuticals run through SEARO and EURO — both currently disrupted.

**Geopolitical context:** Historical perception that AFRO's needs are acknowledged but under-prioritized when global resources are scarce. Strong relationship with Africa CDC for surveillance support. Three member states are experiencing active conflict/humanitarian crisis.

**Strategic priorities:** advocate early and loudly for needs-based vaccine allocation; build technical-support relationships with WPRO/EURO; leverage Africa CDC; prepare for outbreak arrival before international support mobilizes.

**Unique challenge:** most to lose from poor global decisions, least structural power to prevent them.`,
  },
  {
    id: "AMRO",
    fullName: "WHO Regional Office for the Americas (PAHO)",
    roleTitle: "WHO/PAHO Regional Director for the Americas",
    hqLocation: "Washington D.C., United States",
    memberStatesDesc: "35 member states, North/Central/South America + Caribbean",
    populationDesc: "1.0 billion (~13% global)",
    startingFund: 85_000_000,
    startingPpeDays: 45,
    startingAntivirals: 28000,
    startingHcwSurgePct: 25,
    startingSurveillanceIndex: 8,
    startingCfrMultiplier: 1.8,
    populationWeight: 1.1,
    startingPoliticalTension: 30,
    startingPublicTrust: 65,
    startingConfirmed: 8,
    startingDeaths: 0,
    startingEstTrueLow: 80,
    startingEstTrueHigh: 120,
    startingHospCapacityPct: 61,
    startingRt: 3.1,
    profileMarkdown: `**Key constraint:** Vaccine-nationalism pressure from largest member state, which has independently negotiated a bilateral pharmaceutical deal that may conflict with COVAX allocation obligations. AMRO team did not authorize this but is its regional custodian.

**Geopolitical context:** Largest member state has significant leverage over global pharmaceutical supply. AMRO has the strongest NPI implementation capacity of any region — meaning delayed early action here is a political choice, not a resource constraint.

**Strategic priorities:** get ahead of the bilateral-deal story proactively; implement strong early NPIs; build solidarity credibility with AFRO/SEARO early.

**Unique challenge:** the region most capable of leading by example and most tempted to lead by self-interest.`,
  },
  {
    id: "EMRO",
    fullName: "WHO Regional Office for the Eastern Mediterranean",
    roleTitle: "WHO Regional Director for the Eastern Mediterranean",
    hqLocation: "Cairo, Egypt",
    memberStatesDesc: "22 member states, Middle East / North Africa / parts of Central Asia",
    populationDesc: "679 million (~9% global)",
    startingFund: 34_000_000,
    startingPpeDays: 30,
    startingAntivirals: 12000,
    startingHcwSurgePct: 12,
    startingSurveillanceIndex: 5,
    startingCfrMultiplier: 2.6,
    populationWeight: 1.1,
    startingPoliticalTension: 35,
    startingPublicTrust: 55,
    startingConfirmed: 5,
    startingDeaths: 1,
    startingEstTrueLow: 50,
    startingEstTrueHigh: 75,
    startingHospCapacityPct: 44,
    startingRt: 2.6,
    profileMarkdown: `**Key constraint:** Conflict-affected member states consume disproportionate resources and have near-zero capacity to implement NPIs or quarantine.

**Geopolitical context:** Enormous internal diversity — from high-income Gulf states with world-class hospitals to member states with collapsed health systems. Highest global diabetes burden, elevating severity risk. Partial PPE/pharma supply dependency on SEARO manufacturers.

**Strategic priorities:** explicitly triage member states by capacity; use diabetes burden data to argue for comorbid-population vaccine priority; engage the EURO-SEARO travel dispute early.

**Unique challenge:** managing a region containing both some of the world's most capable and most fragile health systems simultaneously.`,
  },
  {
    id: "EURO",
    fullName: "WHO Regional Office for Europe",
    roleTitle: "WHO Regional Director for Europe",
    hqLocation: "Copenhagen, Denmark",
    memberStatesDesc: "53 member states, Europe + Central Asia",
    populationDesc: "930 million (~12% global)",
    startingFund: 210_000_000,
    startingPpeDays: 60,
    startingAntivirals: 55000,
    startingHcwSurgePct: 40,
    startingSurveillanceIndex: 9,
    startingCfrMultiplier: 1.0,
    populationWeight: 0.9,
    startingPoliticalTension: 40,
    startingPublicTrust: 70,
    startingConfirmed: 22,
    startingDeaths: 1,
    startingEstTrueLow: 180,
    startingEstTrueHigh: 300,
    startingHospCapacityPct: 72,
    startingRt: 3.1,
    profileMarkdown: `**Key constraint:** Political pressure from major member states to act unilaterally/visibly, even against WHO guidance. Three member states have already implemented travel bans exceeding WHO guidance.

**Geopolitical context:** Member states include WHO's largest financial contributors, some of whom have signaled continued funding is contingent on WHO aligning with their national policies. High surveillance makes EURO the de facto early-information leader of the simulation.

**Strategic priorities:** address the travel-ban situation immediately on WHO's terms; use surveillance advantage to inform lower-surveillance regions; resist using resource advantage as a shield against equity obligations.

**Unique challenge:** most capable of unilaterally improving global outcomes, most tempted to prioritize member-state politics over WHO's mandate.`,
  },
  {
    id: "SEARO",
    fullName: "WHO Regional Office for South-East Asia",
    roleTitle: "WHO Regional Director for South-East Asia",
    hqLocation: "New Delhi, India",
    memberStatesDesc: "11 member states (India, Indonesia, Thailand, Bangladesh, Nepal, Sri Lanka, and others)",
    populationDesc: "2.0 billion (~26% global)",
    startingFund: 28_000_000,
    startingPpeDays: 22,
    startingAntivirals: 8000,
    startingHcwSurgePct: 15,
    startingSurveillanceIndex: 3,
    startingCfrMultiplier: 3.2,
    populationWeight: 1.15,
    startingPoliticalTension: 70,
    startingPublicTrust: 45,
    startingConfirmed: 84,
    startingDeaths: 4,
    startingEstTrueLow: 700,
    startingEstTrueHigh: 1300,
    startingHospCapacityPct: 52,
    startingRt: 4.2,
    profileMarkdown: `**Note: SEARO carries more detail than other regions by design** — this team is in the most epidemiologically and geopolitically complex position.

**Key constraint:** Political sensitivity limits decision speed. The host government's data-sharing posture directly constrains SEARO's ability to give WHO HQ what it needs to coordinate globally.

**Geopolitical context — the outbreak origin problem:** the host government maintains the outbreak was natural spillover and has refused independent investigation of the research facility at the epicenter. SEARO must navigate without prejudging an unconcluded investigation, while not letting political pressure compromise scientific credibility or IHR obligations.

**Host government dynamics:** will cooperate on clinical data but treats genomic sequence data as a national biosecurity matter; has requested WHO avoid the word "outbreak" publicly; has NOT asked SEARO to misrepresent the epidemiological situation, only to use "careful language."

**Surveillance deficit:** index 3/10 means confirmed cases (84) are almost certainly a severe undercount (true estimate 700-1,300). The Rt estimate of 4.2 may itself be an underestimate. Improving surveillance (via data-sharing, technical support from WPRO/EURO) is one of the highest-return actions available.

**Strategic priorities:** resolve the genomic sequence dispute quickly; implement the most aggressive NPI package member states will accept; formally engage the EURO travel-ban dispute; communicate transparently.

**Unique challenge:** managing an active outbreak with a surveillance deficit while under geopolitical siege.`,
  },
  {
    id: "WPRO",
    fullName: "WHO Regional Office for the Western Pacific",
    roleTitle: "WHO Regional Director for the Western Pacific",
    hqLocation: "Manila, Philippines",
    memberStatesDesc: "37 member states (China, Japan, Australia, South Korea, Philippines, Vietnam, Pacific Island nations, etc.)",
    populationDesc: "1.9 billion (~25% global)",
    startingFund: 96_000_000,
    startingPpeDays: 50,
    startingAntivirals: 32000,
    startingHcwSurgePct: 30,
    startingSurveillanceIndex: 7,
    startingCfrMultiplier: 1.6,
    populationWeight: 1.0,
    startingPoliticalTension: 25,
    startingPublicTrust: 65,
    startingConfirmed: 6,
    startingDeaths: 0,
    startingEstTrueLow: 60,
    startingEstTrueHigh: 90,
    startingHospCapacityPct: 65,
    startingRt: 3.3,
    profileMarkdown: `**Key constraint:** Island-nation members face supply chain vulnerabilities and cannot easily receive international HCW support. Regional strength is very unevenly distributed.

**Geopolitical context:** WPRO's transit hubs are the primary pathway through which NCoV-X1 exits SEARO and reaches other regions, giving WPRO significant leverage in the data-sharing dispute — leverage that should be used constructively, not punitively. Three member states threaten border closures without full SEARO sequence data within 24h.

**Strategic priorities:** manage member-state travel-restriction pressure as leverage for SEARO data-sharing rather than punishment; implement early NPIs at transit hubs; provide surveillance technical support to AFRO/EMRO.

**Unique challenge:** sits at the geographic/operational intersection of the outbreak origin and the rest of the world.`,
  },
];
