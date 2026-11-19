// Pathogen variants (Release 5). Each session draws one at random at
// creation (the facilitator can change it on the setup page before the game
// starts), so runs differ in how fast things spread, how deadly they are,
// and which countermeasures matter. Pure module: used by the model engine,
// the APIs, and client components.
//
// Parameters are taken from published estimates where they exist and marked
// as scenario assumptions where they don't. Sources (via PubMed):
// - Pandemic influenza R: 1918 median 1.80, 2009 median 1.46 (Biggerstaff et
//   al. 2014, BMC Infect Dis, doi:10.1186/1471-2334-14-480). 2009 serial
//   interval mean 3.0 days, 2.6 adjusted for tertiary transmission; R 1.2-2.3,
//   median 1.5 (Boelle et al. 2011, Influenza Other Respir Viruses,
//   doi:10.1111/j.1750-2659.2011.00234.x).
// - Pneumonic plague R0 1.3; latent 4.3 days, infectious 2.5 days (Gani &
//   Leach 2004, Emerg Infect Dis, doi:10.3201/eid1004.030509). Madagascar
//   2017: CFR 25% confirmed, 8% probable, 5% suspected pneumonic cases; all
//   isolates antibiotic-susceptible (Randremanana et al. 2019, Lancet Infect
//   Dis, doi:10.1016/S1473-3099(18)30730-8).
// - Nipah person-to-person R 0.33 (95% CI 0.19-0.59), up to ~1.1 for older
//   patients with breathing difficulty (Nikolay et al. 2019, NEJM,
//   doi:10.1056/NEJMoa1805376). Pooled CFR 9.1%-81.9% across settings;
//   median incubation 8.77 days; nearly all R0 estimates below 1 (Naidoo et
//   al. 2026 systematic review, Lancet Infect Dis,
//   doi:10.1016/S1473-3099(26)00239-2).
// - The novel coronavirus keeps the scenario's own profile
//   (simulation-docs/01-scenario.md).
//
// DRAFT for facilitator review: the game values below are deliberately
// simplified. Two are hypothetical by necessity and say so on screen: real
// Nipah can't sustain a pandemic (R < 1), and a human-transmissible
// avian-origin influenza hasn't happened.

export type PathogenId = "ncov" | "flu" | "plague" | "nipah";

export interface Pathogen {
  id: PathogenId;
  name: string;
  // Replaces "NCoV-X1" in scenario text.
  codeName: string;
  agent: string;
  transmission: string;
  // Shown to players as the key facts card.
  facts: { label: string; value: string }[];
  hypotheticalNote: string | null;
  // Model parameters (lib/model-engine/drift.ts):
  serialIntervalDays: number;
  // Base CFR before the region's multiplier (the coronavirus's 0.8% is its
  // high-ICU-access CFR per 01-scenario.md).
  baseCfr: number;
  // Scales each region's seeded starting Rt, so early effective R matches
  // the pathogen (the seeds are written for the coronavirus).
  rtScale: number;
  // Scales passive Rt creep.
  driftScale: number;
  // What the "antivirals" stockpile represents for this pathogen.
  countermeasure: { singular: string; plural: string; label: string };
  // Text replacements for the coronavirus-specific phrases in event text.
  vaccineText: string;
  genomeText: string;
  sources: string[];
}

export const PATHOGENS: Record<PathogenId, Pathogen> = {
  ncov: {
    id: "ncov",
    name: "Novel coronavirus",
    codeName: "NCoV-X1",
    agent: "Virus (betacoronavirus)",
    transmission: "Respiratory droplets and aerosols; spreads before symptoms",
    facts: [
      { label: "R0 (no measures)", value: "about 4.5" },
      { label: "Time between cases", value: "about 5 days" },
      { label: "Case fatality", value: "about 2% overall (0.8% with good ICU access)" },
      { label: "Countermeasures", value: "Antivirals; candidate vaccine mid-game" },
    ],
    hypotheticalNote: null,
    serialIntervalDays: 5,
    baseCfr: 0.008,
    rtScale: 1,
    driftScale: 1,
    countermeasure: { singular: "antiviral", plural: "antivirals", label: "Antivirals" },
    vaccineText: "71% efficacy vs. severe disease, Phase 2 data only",
    genomeText: "spike protein RBD",
    sources: ["simulation-docs/01-scenario.md (scenario profile)"],
  },
  flu: {
    id: "flu",
    name: "Pandemic influenza",
    codeName: "Influenza A(HxN1)-X",
    agent: "Virus (influenza A, avian-origin reassortant)",
    transmission: "Respiratory droplets; very short time between cases",
    facts: [
      { label: "R (pandemic range)", value: "about 1.5-1.8 (past pandemics)" },
      { label: "Time between cases", value: "about 3 days" },
      { label: "Case fatality", value: "game assumes about 1% (severe pandemic)" },
      { label: "Countermeasures", value: "Antivirals work best given early; a strain-matched vaccine takes months" },
    ],
    hypotheticalNote: "Hypothetical: a human-transmissible avian-origin influenza has not occurred. Spread values are based on past pandemics.",
    serialIntervalDays: 3,
    baseCfr: 0.005,
    rtScale: 1.05,
    driftScale: 0.8,
    countermeasure: { singular: "antiviral", plural: "antivirals", label: "Antivirals" },
    vaccineText: "a pre-pandemic candidate vaccine, estimated 60% efficacy from immunogenicity data only",
    genomeText: "hemagglutinin (HA) receptor-binding and cleavage-site sequences",
    sources: ["Biggerstaff 2014 doi:10.1186/1471-2334-14-480", "Boelle 2011 doi:10.1111/j.1750-2659.2011.00234.x"],
  },
  plague: {
    id: "plague",
    name: "Pneumonic plague",
    codeName: "Y. pestis outbreak strain YP-X",
    agent: "Bacterium (Yersinia pestis)",
    transmission: "Respiratory droplets from people with plague pneumonia; close contact",
    facts: [
      { label: "R0", value: "about 1.3 before control measures" },
      { label: "Time between cases", value: "about 5-6 days" },
      { label: "Case fatality", value: "5-25% with prompt antibiotics; near 100% untreated" },
      { label: "Countermeasures", value: "Antibiotics (treatment and contacts); no licensed vaccine" },
    ],
    hypotheticalNote: null,
    serialIntervalDays: 5.5,
    baseCfr: 0.06,
    rtScale: 0.85,
    driftScale: 0.7,
    countermeasure: { singular: "antibiotic", plural: "antibiotics", label: "Antibiotics" },
    vaccineText: "an experimental plague vaccine (no licensed vaccine exists; Phase 2 immunogenicity data only)",
    genomeText: "plasmid-borne virulence genes and antibiotic-resistance markers",
    sources: ["Gani & Leach 2004 doi:10.3201/eid1004.030509", "Randremanana 2019 doi:10.1016/S1473-3099(18)30730-8"],
  },
  nipah: {
    id: "nipah",
    name: "Nipah-like henipavirus",
    codeName: "NiV-X",
    agent: "Virus (henipavirus, variant)",
    transmission: "Close contact with body fluids and respiratory secretions",
    facts: [
      { label: "R (game assumption)", value: "about 1.2 for this variant (real Nipah: about 0.3)" },
      { label: "Time between cases", value: "about 12 days (incubation about 9 days)" },
      { label: "Case fatality", value: "very high: 40% or more (real outbreaks 9-82%)" },
      { label: "Countermeasures", value: "Experimental monoclonal antibodies; no licensed vaccine" },
    ],
    hypotheticalNote:
      "Hypothetical variant: real Nipah virus spreads person-to-person too poorly to cause a pandemic (R about 0.3). The game assumes a variant that spreads more easily.",
    serialIntervalDays: 12,
    baseCfr: 0.4,
    rtScale: 0.82,
    driftScale: 0.5,
    countermeasure: { singular: "monoclonal antibody course", plural: "monoclonal antibody courses", label: "Monoclonals" },
    vaccineText: "an experimental vaccine (Phase 1 safety data only)",
    genomeText: "G glycoprotein receptor-binding region",
    sources: ["Nikolay 2019 doi:10.1056/NEJMoa1805376", "Naidoo 2026 doi:10.1016/S1473-3099(26)00239-2"],
  },
};

export const PATHOGEN_IDS = Object.keys(PATHOGENS) as PathogenId[];

export function pathogenFor(id: string | null | undefined): Pathogen {
  return PATHOGENS[(id as PathogenId) ?? "ncov"] ?? PATHOGENS.ncov;
}

// UI wording for the "antivirals" stockpile (the ANTIVIRALS resource), so
// forms and ledgers name the right countermeasure. Antivirals are counted in
// doses; antibiotic and monoclonal treatment in courses.
export function countermeasureUnits(id: string | null | undefined): {
  label: string; // "Antibiotics"
  unit: string; // "course"
  formLabel: string; // "Antibiotics (courses)"
  phrase: string; // "antibiotic courses"
} {
  const c = pathogenFor(id).countermeasure;
  const unit = c.singular === "antiviral" ? "dose" : "course";
  const phrase = c.singular.endsWith(unit) ? c.plural : `${c.singular} ${unit}s`;
  return { label: c.label, unit, formLabel: `${c.label} (${unit}s)`, phrase };
}

// A region's starting Rt for this pathogen (the seeds are written for the
// coronavirus), never below 1.05 so every game starts with a growing outbreak.
export function startingRtFor(seedRt: number, p: Pathogen): number {
  return Math.max(1.05, Math.round(seedRt * p.rtScale * 100) / 100);
}

export function randomPathogenId(rng: () => number = Math.random): PathogenId {
  return PATHOGEN_IDS[Math.floor(rng() * PATHOGEN_IDS.length)];
}

// Swaps the coronavirus-specific phrases in authored scenario text for the
// session's pathogen. A no-op for the coronavirus.
export function applyPathogenText(text: string, pathogenId: string | null | undefined): string {
  const p = pathogenFor(pathogenId);
  if (p.id === "ncov" || !text) return text;
  return text
    .replaceAll("NCoV-X1", p.codeName)
    .replaceAll("spike protein RBD", p.genomeText)
    .replaceAll("71% efficacy vs. severe disease, Phase 2 data only", p.vaccineText)
    .replace(/\bantivirals\b/g, p.countermeasure.plural)
    .replace(/\bantiviral\b/g, p.countermeasure.singular);
}
