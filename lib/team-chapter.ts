// Item 7's "chapter of history" — a one-page generated artifact per region,
// shown at end-of-game. People keep artifacts; an artifact is what makes a
// region's specific playthrough feel like it actually happened, rather than
// just leaving behind a row in a spreadsheet. The headline is templated
// (not free-form generation) off the region's actual tier distribution and
// its prevented-vs-caused numbers from the optimal shadow comparison
// (see lib/final-results.ts) — deterministic, so it always reads as earned
// rather than random.

import { db } from "./db";
import { computeFinalResults } from "./final-results";
import type { Tier } from "./db/seed-data/events";

export interface TeamChapter {
  regionId: string;
  headline: string;
  narrative: string;
  tierCounts: Record<Tier, number>;
  totalDecisions: number;
  actualConfirmed: number;
  actualDeaths: number;
  infectionsPrevented: number;
  deathsPrevented: number;
  keyDecisions: { eventId: string; eventTitle: string; tier: Tier; compositePct: number }[];
}

function pickHeadline(regionId: string, tierCounts: Record<Tier, number>, total: number, deathsPrevented: number, actualDeaths: number): { headline: string; narrative: string } {
  const optimalPct = total > 0 ? tierCounts.OPTIMAL / total : 0;
  const criticalPct = total > 0 ? tierCounts.CRITICAL_FAILURE / total : 0;

  if (total === 0) {
    return { headline: `${regionId}: An Untested Office`, narrative: "No decisions were scored for this region this session." };
  }
  if (criticalPct >= 0.3) {
    return {
      headline: `${regionId}: A Region in Freefall`,
      narrative: `${tierCounts.CRITICAL_FAILURE} of ${total} decisions ended in critical failure. This region's story this session is one of a crisis that consistently outran the response.`,
    };
  }
  if (optimalPct >= 0.5) {
    return {
      headline: `${regionId}: The Model Response`,
      narrative: `${tierCounts.OPTIMAL} of ${total} decisions scored Optimal. Other regions were watching this office for a reason.`,
    };
  }
  if (deathsPrevented <= 0 && actualDeaths >= 0) {
    return {
      headline: `${regionId}: The Quiet Stabilizer`,
      narrative: `No dramatic wins, no collapses — this region tracked closest to the ideal-response benchmark of anyone in the room.`,
    };
  }
  return {
    headline: `${regionId}: A Region of Hard Trade-offs`,
    narrative: `A mixed record — real wins alongside real costs. ${tierCounts.OPTIMAL} Optimal, ${tierCounts.INADEQUATE + tierCounts.CRITICAL_FAILURE} Inadequate or worse, out of ${total} decisions.`,
  };
}

export async function computeAllTeamChapters(): Promise<TeamChapter[]> {
  const allTeams = await db.query.teams.findMany();
  const allDispatches = await db.query.eventDispatches.findMany();
  const allDecisions = await db.query.decisions.findMany();
  const allScores = await db.query.scores.findMany();
  const allEvents = await db.query.events.findMany();
  const finalResults = await computeFinalResults();

  return allTeams.map((team) => {
    const tierCounts: Record<Tier, number> = { OPTIMAL: 0, ADEQUATE: 0, INADEQUATE: 0, CRITICAL_FAILURE: 0 };
    const scoredEntries: { eventId: string; eventTitle: string; tier: Tier; compositePct: number }[] = [];

    for (const decision of allDecisions.filter((d) => d.teamId === team.id)) {
      const score = allScores.find((s) => s.decisionId === decision.id);
      if (!score) continue;
      tierCounts[score.tier as Tier]++;
      const dispatch = allDispatches.find((d) => d.id === decision.eventDispatchId);
      const event = dispatch ? allEvents.find((e) => e.id === dispatch.eventId) : null;
      if (event) scoredEntries.push({ eventId: event.id, eventTitle: event.title, tier: score.tier as Tier, compositePct: score.compositePct });
    }

    const total = scoredEntries.length;
    const region = finalResults.regions.find((r) => r.regionId === team.regionId);
    const { headline, narrative } = pickHeadline(team.regionId, tierCounts, total, region?.deathsPrevented ?? 0, region?.actualDeaths ?? 0);

    return {
      regionId: team.regionId,
      headline,
      narrative,
      tierCounts,
      totalDecisions: total,
      actualConfirmed: region?.actualConfirmed ?? 0,
      actualDeaths: region?.actualDeaths ?? 0,
      infectionsPrevented: region?.infectionsPrevented ?? 0,
      deathsPrevented: region?.deathsPrevented ?? 0,
      keyDecisions: scoredEntries.sort((a, b) => b.compositePct - a.compositePct).slice(0, 3),
    };
  });
}
