// "The short version" shown at the top of each event page (Release 2
// playtest request): one or two plain-language sentences per event so a team
// juggling several events can grasp each one quickly before reading the full
// narrative. Drafted from each event's narrativeMarkdown and
// decisionPromptMarkdown in ./events.ts; these add no new facts. Static
// content (no DB column), so editing a line here needs no reseed.
//
// DRAFT: written by Claude for the facilitator to review against
// simulation-docs/03-events.md before the spring run.
export const eventSummaries: Record<string, string> = {
  "EVT-001": "The Emergency Committee is meeting on whether this outbreak is a global emergency (PHEIC). Decide whether to declare, how to word it, and whether to honor SEARO's request to avoid the word \"outbreak.\"",
  "EVT-002": "SEARO shared the virus genome with a key section removed, and neighbors are threatening border closures. SEARO must answer WHO's data request; WPRO and EURO state their position.",
  "EVT-003": "Three EURO states imposed travel bans stricter than WHO advises, and SEARO has formally protested. EURO must justify the bans; everyone else decides whether WHO should challenge them publicly.",
  "EVT-004": "WHO wants each region's plan to slow spread within hours, while the containment window is still open. Choose your measures, timeline, messaging, and protections for vulnerable groups.",
  "EVT-005": "SEARO health workers are getting infected because of a PPE shortage, and EMRO is running low too. SEARO asks for help; other regions decide what to contribute and on what terms.",
  "EVT-006": "180,000 early vaccine doses are available for WHO to share across all six regions. Propose how to split them and justify it on evidence, feasibility, and equity.",
  "EVT-007": "MSF has responded publicly to how the vaccines were allocated. All regions must agree on one joint WHO response, or it counts as a coordination failure.",
  "EVT-008": "A leak shows AMRO's largest member state signed a separate vaccine deal the same day as the shared one. AMRO must explain it; others say what WHO should do.",
  "EVT-009": "Public compliance with health measures has collapsed and a huge religious gathering is days away. Set out an emergency communication and enforcement plan.",
  "EVT-010": "A viral post claims the virus is a bioweapon, pointing to SEARO's redacted genome. Plan a coordinated response to the misinformation without claiming to know the virus's origin.",
  "EVT-011": "AFRO's hospitals are full and it has no health workers in reserve, so it is asking for international help. Other regions decide how many staff to send and on what terms; AFRO says where they are needed most.",
  "EVT-012": "A second batch of vaccines is available. Allocate it again, explaining how it corrects or builds on your first allocation and what data you used.",
  "EVT-013": "Member states are pressuring WHO: SEARO's government wants to pre-approve WHO statements, EURO states want their bans endorsed, AMRO's largest state wants the leak story denied. Decide whether to accommodate or refuse, and on what basis.",
  "EVT-014": "Week-in-review briefing: your region's trajectory and the global picture. No decision needed.",
  "EVT-015": "Propose reforms to the International Health Regulations based on what went wrong this week, including one of your own decisions the reform would have improved.",
  "EVT-016": "The simulation is closing and the after-action report begins. No decision needed.",
  "EVT-017": "Public trust in your regional office has slipped below 45. Choose how to respond before it gets worse.",
  "EVT-018": "Public trust has fallen below 30 and people are openly questioning WHO's guidance. Choose a crisis-communication response.",
  "EVT-019": "Public trust has collapsed below 15 and aid convoys are being harassed. Choose an emergency response.",
  "EVT-020": "Public morale in your region has dropped below 45 from pandemic fatigue. Choose whether and how to respond.",
  "EVT-021": "Morale has fallen below 30, with small protests and hostility toward health workers. Choose a response before it becomes unrest.",
  "EVT-022": "Morale has collapsed below 15 and health workers are walking off shifts. Choose an emergency response.",
  "EVT-023": "Political tension with member states is above 60 and relations are getting strained. Choose how to respond.",
  "EVT-024": "Tension is above 75 and a member state has suspended data sharing. Choose how to resolve the standoff.",
  "EVT-026": "The fast-tracked countermeasure is meeting heavy hesitancy. Decide how to rebuild confidence without making it worse.",
  "EVT-027": "Labs have found samples resistant to standard treatment. Decide how fast to share the findings and what to change in treatment now.",
  "EVT-028": "A huge PPE factory burned down and prices tripled. Decide how to secure PPE: together with other regions, alone, or by restricting exports.",
  "EVT-029": "Tens of thousands of people are heading for your borders. Decide how to manage the crossings safely.",
  "EVT-025": "Tension is above 90 and a member state has suspended cooperation; you're cut off from the WHO HQ marketplace and emergency funding while this lasts. Choose an emergency response.",
};
