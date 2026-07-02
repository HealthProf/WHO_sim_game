// Item 3's "personified recurring stakeholders" — a small recurring cast of
// named fictional characters (never a real journalist, aid worker, or
// diplomat) who react to a specific region's actual decision history over
// the course of the session. Distinct from the Advisory Board
// (lib/db/seed-data/advisory-opinions.ts): advisory opinions are generic
// institutional roles giving pre-decision input, shared identically across
// all six teams. These are the opposite — the same three named voices,
// private to one region, commenting AFTER the fact on choices that region
// specifically made. A recurring cast across many small moments is what
// makes a simulated world feel inhabited rather than procedural.
//
// Only reacts to the two narratively loaded extremes (OPTIMAL and
// CRITICAL_FAILURE) — reacting to every routine Adequate/Inadequate score
// would turn a small cast of characters into background noise.

import { db } from "./db";
import { teamNotifications } from "./db/schema";
import type { Tier } from "./db/seed-data/events";

interface Stakeholder {
  name: string;
  role: string;
}

const STAKEHOLDERS = {
  journalist: { name: "Amara Osei", role: "Correspondent, Regional Press Corp" },
  msf: { name: "Dr. Lena Voss", role: "MSF Field Director" },
  diplomat: { name: "Amb. Chen Wei", role: "Donor-State Diplomat" },
} satisfies Record<string, Stakeholder>;

type StakeholderId = keyof typeof STAKEHOLDERS;

const REACTIONS: Record<"OPTIMAL" | "CRITICAL_FAILURE", Record<StakeholderId, string[]>> = {
  OPTIMAL: {
    journalist: [
      "Two straight months of coverage and I still can't find a story here — that's the highest compliment I can give a health ministry.",
      "Off the record: this is the first regional office all year my editor hasn't asked me to investigate.",
    ],
    msf: [
      "Whatever you're doing, keep doing it. Our teams on the ground are seeing it.",
      "I've stopped bracing for the follow-up call after these updates. That's new.",
    ],
    diplomat: [
      "My capital is asking fewer questions about this region than any other on my desk. Consider that a rare compliment.",
      "We're comfortable increasing our informal confidence in this office's judgment.",
    ],
  },
  CRITICAL_FAILURE: {
    journalist: [
      "I have three sources willing to go on record about this. I'm giving you 24 hours before I run it.",
      "This is going to be a very hard story to write kindly.",
    ],
    msf: [
      "We are now operating with less support than we were promised. That has a cost, and it isn't ours to carry.",
      "I need you to understand this decision has consequences that won't show up in a report.",
    ],
    diplomat: [
      "This is now a conversation above my pay grade. I wanted you to hear that from me before you heard it from someone else.",
      "My capital used the word \"pattern.\" That's not a word they use lightly.",
    ],
  },
};

const STAKEHOLDER_IDS = Object.keys(STAKEHOLDERS) as StakeholderId[];

export async function maybeStakeholderReact(teamId: number, tier: Tier) {
  if (tier !== "OPTIMAL" && tier !== "CRITICAL_FAILURE") return;

  const stakeholderId = STAKEHOLDER_IDS[Math.floor(Math.random() * STAKEHOLDER_IDS.length)];
  const stakeholder = STAKEHOLDERS[stakeholderId];
  const lines = REACTIONS[tier][stakeholderId];
  const quote = lines[Math.floor(Math.random() * lines.length)];

  await db.insert(teamNotifications).values({
    teamId,
    kind: "stakeholder",
    message: `${stakeholder.name} (${stakeholder.role}): "${quote}"`,
  });
}
