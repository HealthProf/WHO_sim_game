// "Advisory board" perspectives shown alongside each decision event —
// deliberately diverse, sometimes contradictory, and sometimes pulling
// toward a politically-expedient-but-epidemiologically-weaker choice, the
// way real advisors would. These are NOT a recommendation toward the
// Optimal tier — several openly argue for options that would actually
// score Inadequate or worse. That tension is the point: real decisions get
// made under exactly this kind of competing pressure, not in a vacuum
// where the "best" evidence-based option is obviously correct to everyone
// in the room.
//
// Perspectives use generic institutional/role framing (a host government
// liaison, a major donor state diplomat, a regional trade envoy) rather
// than naming real countries — consistent with how 01-04's own event text
// handles the same ambiguity (e.g. SEARO's host government is never named).
// Shared across all six teams per event (not region-specific) — the
// diversity comes from the roles represented, not from repeating six times.
//
// Not authored for EVT-014/EVT-016 (informational/administrative events
// with no decision to advise on).

export interface AdvisoryOpinion {
  role: string;
  opinion: string;
}

export const advisoryOpinions: Record<string, AdvisoryOpinion[]> = {
  "EVT-001": [
    {
      role: "WHO Legal Counsel (IHR interpretation)",
      opinion:
        "Article 12's criteria — an extraordinary event, public health risk to other states, potential need for coordinated response — are unambiguously met. Delaying now to \"gather more data\" is a political choice dressed up as a technical one, and it creates real liability exposure if we're seen to have sat on a declarable emergency.",
    },
    {
      role: "Field Epidemiologist",
      opinion:
        "The confirmed count is 128, but our own modeling says true cases are 8-15x that. If anything we're already behind. Waiting 48 hours to declare is waiting 48 hours we don't have — every day of delay is measured in additional undetected transmission chains.",
    },
    {
      role: "Host Government Liaison (SEARO)",
      opinion:
        "The word \"outbreak\" — let alone \"PHEIC\" — triggers panic buying, canceled trade contracts, and travel restrictions on communities that haven't even seen a case yet. We're not asking WHO to hide anything, just to be precise about what's actually confirmed versus modeled.",
    },
    {
      role: "Major Donor State Diplomat",
      opinion:
        "My government will support the science, but be aware a premature or overly dramatic declaration plays badly domestically if this turns out to be contained quickly — and that affects how willingly we fund the response that follows.",
    },
  ],
  "EVT-002": [
    {
      role: "WHO Reference Lab Director",
      opinion:
        "Without the full spike protein sequence, every lab outside the host country is working blind — no independently verified tests, no vaccine candidate validation, nothing. Partial or delayed release doesn't just slow us down, it actively degrades the quality of everyone else's response.",
    },
    {
      role: "National Biosecurity Advisor (host government)",
      opinion:
        "That sequence data isn't just academic — it can reveal details about the research facility at the epicenter that our government considers a legitimate national security matter, independent of any question about the outbreak's origin. Controlled release to vetted reference labs addresses the science without opening that door.",
    },
    {
      role: "WPRO Trade & Transit Minister",
      opinion:
        "We are the primary corridor this pathogen is moving through to reach the rest of the world, and we are not going to sit on our hands waiting politely. Twenty-four hours, full data, or the border closes — that's not a threat, that's just how much exposure our own population can absorb.",
    },
    {
      role: "Independent Virologist (MSF-aligned)",
      opinion:
        "\"Biosecurity concerns\" is doing a lot of work in that sentence. If there's a legitimate concern, name it and let WHO's reference labs assess it under confidentiality — redacting the one piece of data everyone actually needs looks like concealment even if it isn't.",
    },
  ],
  "EVT-003": [
    {
      role: "WHO IHR Legal Advisor",
      opinion:
        "Article 43 exists precisely for this situation — measures beyond WHO guidance require notification and scientific justification. Skipping that step isn't just a process foul, it's the exact behavior the IHR was written to prevent, and other member states will notice we let it slide.",
    },
    {
      role: "EURO Domestic Public Health Minister",
      opinion:
        "My constituents can see the case numbers rising in real time. A visible travel measure is something they can point to and feel protected by — \"wait for risk-stratified screening protocols\" doesn't poll well when people are frightened, whatever the epidemiological merits.",
    },
    {
      role: "SEARO Trade & Diplomacy Envoy",
      opinion:
        "A blanket ban with no sunset clause and no humanitarian corridor doesn't slow the virus at this point — our transmission is already active. What it does is cut off medical supplies, tourism revenue, and legitimate travelers, and it tells every one of our citizens abroad that they're being treated as a biohazard.",
    },
    {
      role: "MSF Logistics Officer",
      opinion:
        "We're already seeing delays in antiviral and PPE shipments routed through EURO hubs. Every day this drags on without an exemption for medical supply chains is a day SEARO's frontline capacity gets worse — which, ironically, makes the outbreak EURO is worried about larger, not smaller.",
    },
  ],
  "EVT-004": [
    {
      role: "WHO NPI Technical Advisor",
      opinion:
        "Single measures don't work — the evidence is overwhelming that layered bundles of four or more interventions, sustained long enough to matter, are what actually bends the curve. Anything less is optics, not containment.",
    },
    {
      role: "Regional Economic Council",
      opinion:
        "Every capacity limit and mandate has a payroll attached to it. We can support a moderate package, but a maximal lockdown-style bundle risks a second crisis — unemployment and business failure — that this simulation isn't scoring you on but that member states will absolutely hold against you politically.",
    },
    {
      role: "Informal/Daily-Wage Worker Advocate",
      opinion:
        "Whatever package you choose, if there's no support for people who can't work from home or afford to miss a shift, you're asking your poorest citizens to absorb the entire cost of compliance. An NPI bundle without equity provisions doesn't fail evenly — it fails on the same people every time.",
    },
    {
      role: "Local Elected Official",
      opinion:
        "I supported strong measures during the last health scare and I'm still hearing about it at every town hall. People are tired. If you want this to actually be followed rather than just announced, it has to come with a clear, honest timeline for review — open-ended restrictions lose compliance fast.",
    },
  ],
  "EVT-005": [
    {
      role: "SEARO Chief Medical Officer",
      opinion:
        "Fourteen confirmed HCW infections and PPE stock counted in days, not weeks. Our frontline staff are making impossible choices right now. This isn't a policy debate for us, it's Tuesday — we need material help, not more assessments.",
    },
    {
      role: "EMRO Health Minister",
      opinion:
        "We have our own shortage, less acute but real, and several member states already stretched by ongoing humanitarian crises. I want to help — genuinely — but I can't in good conscience empty our own reserve for a crisis that may reach us next.",
    },
    {
      role: "Donor Region Finance Officer",
      opinion:
        "Twenty percent of our regional PPE stock sounds generous until you remember this pathogen has a 4.5 R0 and hasn't been confirmed in our region yet. Solidarity today could mean our own frontline workers exposed tomorrow with no reserve left.",
    },
    {
      role: "WHO Ethics Advisor",
      opinion:
        "This is exactly the kind of moment the equity scoring exists for. A whistleblower has already alleged concealment of the true infection numbers — how the rest of the institution responds to that, materially and not just rhetorically, will define whether \"WHO solidarity\" means anything at all this week.",
    },
  ],
  "EVT-006": [
    {
      role: "COVAX Secretariat Representative",
      opinion:
        "We built this mechanism specifically so allocation wouldn't default to whoever has the most purchasing power. CFR-multiplier-weighted, needs-based distribution isn't just the equitable choice, it's the one supported by the actual mortality data sitting on every region's dashboard right now.",
    },
    {
      role: "AMRO-Adjacent Bilateral Diplomat",
      opinion:
        "\"Operational readiness\" matters as much as raw need — cold-chain infrastructure, trained staff, distribution logistics. Doses that can't be administered quickly are doses wasted. That's not politics, that's logistics, even if it happens to favor regions with stronger existing infrastructure.",
    },
    {
      role: "AFRO Regional Director's Advisor",
      opinion:
        "We have the highest CFR multiplier in the simulation and the least structural power to change that. If this allocation doesn't prioritize us and SEARO on the numbers alone, it isn't a hard call anyone got wrong — it's a choice, and everyone will know it was a choice.",
    },
    {
      role: "MSF Field Coordinator",
      opinion:
        "We are watching this allocation in real time and so is the press. Anything that reads as politically or economically influenced — rather than justified by transmission and mortality data — will not stay quiet. Choose the framework you can defend publicly, not just the one that's easiest to agree on today.",
    },
  ],
  "EVT-007": [
    {
      role: "WHO Communications Director",
      opinion:
        "If the allocation was inequitable, the fastest way to stop the bleeding is a specific, concrete corrective commitment — not a defensive statement. Vague acknowledgment without a plan reads as PR; specificity reads as accountability.",
    },
    {
      role: "Legal/Risk Advisor",
      opinion:
        "Be careful what you admit to in writing. A joint acknowledgment framed as an unqualified admission of fault could be cited in future disputes over resource allocation obligations. There's a way to commit to doing better without conceding legal liability.",
    },
    {
      role: "AFRO/SEARO Regional Advisors",
      opinion:
        "A rebuttal right now, on the heels of an allocation that under-served us, would confirm exactly what MSF is alleging — that WHO is more interested in defending itself than fixing the problem. Anything short of a clear acknowledgment will be read, correctly, as institutional indifference.",
    },
    {
      role: "Major Donor Communications Liaison",
      opinion:
        "An unqualified public apology narrative is a gift to anyone looking to argue WHO mismanaged this response — including in budget conversations down the line. A measured, corrective tone serves everyone's interests better than a mea culpa.",
    },
  ],
  "EVT-008": [
    {
      role: "Investigative Journalist (source of the leak)",
      opinion:
        "A 200,000-dose bilateral deal signed the same day as the COVAX negotiation isn't a footnote, it's the story. My readers will judge this on whether WHO holds the region accountable or lets \"sovereign right\" become the answer to every hard question.",
    },
    {
      role: "AMRO Member State Trade Representative",
      opinion:
        "Bilateral procurement is legal, it was disclosed through the appropriate national channels, and no multilateral agreement obligates us to route every dose through COVAX. We understand the optics are bad, but \"bad optics\" isn't the same as a violation.",
    },
    {
      role: "AFRO Regional Director",
      opinion:
        "We just went through the vaccine equity crucible together. If double-dipping is allowed to stand without consequence days later, every equity commitment made this week is worth exactly as much as the next headline that contradicts it.",
    },
    {
      role: "WHO Legal Counsel",
      opinion:
        "The fastest way out of this is partial disclosure paired with a real corrective gesture — some meaningful share of that bilateral allocation routed back through COVAX. It costs less than a formal investigation and it's the version of this story people will actually stop repeating.",
    },
  ],
  "EVT-009": [
    {
      role: "Public Health Enforcement Advisor",
      opinion:
        "Eighty thousand people indoors, community transmission already active, compliance below 40% — the super-spreader math here isn't speculative, it's close to certain. Cancellation with a livestream alternative is the only option that actually changes the outcome.",
    },
    {
      role: "Religious/Community Leader (gathering organizers)",
      opinion:
        "This gathering is not incidental to our community — for many people it is the primary source of support they have left in a frightening time. Ordering it cancelled from outside, without real dialogue first, will be treated as an attack, and it will make every future request for cooperation harder.",
    },
    {
      role: "Local Elected Official",
      opinion:
        "If I forcibly cancel this and it's seen as heavy-handed, I lose the political capital I need for the NPI measures we'll need next week. A modification — capacity limits, masks, outdoor if possible — lets everyone save face while still reducing risk.",
    },
    {
      role: "Misinformation Response Specialist",
      opinion:
        "Whatever you decide about the gathering itself, if you don't pair it with proactive engagement addressing the \"NPIs are theatre\" campaign directly, compliance keeps collapsing regardless of what you announce.",
    },
  ],
  "EVT-010": [
    {
      role: "Digital/Media Response Specialist",
      opinion:
        "This thread has 4.2 million shares in six hours. A measured, wait-and-see statement will be buried by the algorithm within the hour. Only a fast, specific, evidence-based rebuttal — engaging the actual claims, not just gesturing at \"ongoing investigation\" — has a chance of slowing this.",
    },
    {
      role: "Diplomatic Advisor",
      opinion:
        "Escalating a social media conspiracy theory to the UN Security Council doesn't contain it — it legitimizes it. That's exactly the kind of overreaction that becomes its own headline and hands the original claim more credibility than it ever had on its own.",
    },
    {
      role: "SEARO Regional Director",
      opinion:
        "My office is fielding hundreds of media requests an hour and we did not create this narrative — the sequence redaction from days ago did. I need WHO headquarters to take the lead publicly. We cannot be the sole face of this response.",
    },
    {
      role: "Independent Science Journalist",
      opinion:
        "Directly confronting the preprint's authors risks looking like an institution bullying an independent researcher into silence, which becomes its own story. Correct the science through the scientific process — journal correspondence, expert commentary — not a public pressure campaign.",
    },
  ],
  "EVT-011": [
    {
      role: "AFRO Regional Director",
      opinion:
        "Bed occupancy over 95%, zero reserve capacity, in two member states already. This isn't a request for money we can spend later — we need trained hands on the ground now, and every day of delay is measured in excess mortality that a financial contribution alone cannot prevent.",
    },
    {
      role: "EURO Health Ministry Official",
      opinion:
        "We have the highest surplus capacity of any region, but \"surplus\" doesn't mean \"idle\" — our own hospitals are running hot too. A full 15% deployment is possible, but it is not free, and I need to be honest about what it costs us at home before I commit to it.",
    },
    {
      role: "Domestic Healthcare Worker Union Representative",
      opinion:
        "Deploying our own staff abroad for a week sounds reasonable until you're the nurse covering their shifts on top of your own. If leadership commits to this, it needs real support for the workers left holding the home hospital together, not just a press release about solidarity.",
    },
    {
      role: "WHO Emergency Operations Coordinator",
      opinion:
        "This is very likely the single highest-leverage solidarity decision left in the simulation. A financial contribution alone, without deployed personnel, will not stabilize AFRO's system in the timeframe that matters — money doesn't staff a ward, trained people do.",
    },
  ],
  "EVT-012": [
    {
      role: "COVAX Secretariat Representative",
      opinion:
        "This tranche is the test of whether the first allocation was a one-time lapse or a pattern. The dashboard now shows three days of consequences from the first decision — there's no excuse this time for an allocation that doesn't visibly correct course.",
    },
    {
      role: "AFRO/SEARO Regional Advisors",
      opinion:
        "We are watching this allocation more closely than the first one, not less. If the pattern repeats after everything that's happened since — the MSF letter, the disclosure, the healthcare strain — that will be read as a decision, not an oversight.",
    },
    {
      role: "AMRO Diplomat (post-disclosure)",
      opinion:
        "We are under real pressure to prove good faith after the bilateral-deal story broke. Expect a public commitment to equity here — whether it's matched by the substance of the actual numbers is a separate question worth watching closely.",
    },
    {
      role: "Independent Public Health Auditor",
      opinion:
        "Whatever framework you choose, cite the dashboard data explicitly in your justification — confirmed cases, CFR multipliers, capacity strain. A framework that isn't grounded in the live numbers in front of you will not hold up to the comparison this event is designed to produce.",
    },
  ],
  "EVT-013": [
    {
      role: "WHO Constitutional/Legal Advisor",
      opinion:
        "Independence from member-state political control is WHO's entire institutional value proposition. Concede it once under pressure and every future demand from every other member state gets easier to make and harder to refuse.",
    },
    {
      role: "Host/Member State Government Liaison",
      opinion:
        "This isn't an abstract principle for us — it's funding, market access, and diplomatic relationships that affect real people. \"Constitutional independence\" doesn't pay for the country office's operating budget if the relationship collapses.",
    },
    {
      role: "Regional Director's Chief of Staff",
      opinion:
        "A principled public refusal sounds right in a briefing document. In practice, if it costs us our operating presence in-country, it's not the vulnerable populations we're trying to protect who bear that cost lightest — it's the ones who most needed us to still be there.",
    },
    {
      role: "Fellow Regional Directors (in solidarity)",
      opinion:
        "If one region capitulates to this kind of pressure, every other regional office should expect the same demand within the month. This is bigger than one relationship — a united, negotiated-but-firm front protects all six of us.",
    },
  ],
  "EVT-015": [
    {
      role: "IHR Reform Working Group Chair",
      opinion:
        "Enforcement mechanisms and financial penalties sound decisive, but without paired investment in the surveillance capacity of under-resourced regions, penalties just punish the same regions that lacked the capacity to comply in the first place.",
    },
    {
      role: "AFRO/SEARO Legal Advisors",
      opinion:
        "An equity amendment with a mandatory COVAX-equivalent mechanism directly addresses what actually happened this week, not a hypothetical future failure. Reform that doesn't reference the actual gaps this simulation exposed is reform in name only.",
    },
    {
      role: "Major Donor State Legal Counsel",
      opinion:
        "New binding enforcement powers over sovereign states are a much harder sell domestically than transparency and verification mechanisms. If you want broad buy-in rather than a proposal that dies in committee, transparency is the more achievable win.",
    },
    {
      role: "Independent Global Health Historian",
      opinion:
        "Post-crisis reform proposals are common; reform proposals that survive the next budget cycle are rare. The ones that last are specific and tied to a concrete failure someone can point to — generic, templated language tends to quietly disappear.",
    },
  ],
};
