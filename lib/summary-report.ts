// Builds the round-by-round after-action summary: one "round" per event
// that has at least one scored dispatch, with every region's structured
// choice, rationale, and resulting consequence tier/impact. Deliberately
// cross-team (a region's rationale is normally private to that team — see
// 04-regions.md's data-access-layer note — but this report only exists once
// the game has ended, at which point full transparency across teams is the
// point of the after-action debrief).

import { db } from "./db";

export interface SummaryRoundEntry {
  regionId: string;
  structuredChoice: string | null;
  rationaleText: string;
  resourceAllocationJson: Record<string, number> | null;
  coordinatedWithTeamsJson: string[] | null;
  tier: string | null;
  compositePct: number | null;
  impactDesc: string | null;
}

export interface SummaryRound {
  eventId: string;
  title: string;
  day: number;
  narrativeMarkdown: string;
  category: string;
  entries: SummaryRoundEntry[];
}

export async function buildSummaryReport(): Promise<SummaryRound[]> {
  const allEvents = await db.query.events.findMany({ orderBy: (t, { asc }) => [asc(t.day)] });
  const allDispatches = await db.query.eventDispatches.findMany();
  const allDecisions = await db.query.decisions.findMany();
  const allScores = await db.query.scores.findMany();
  const allTeams = await db.query.teams.findMany();

  const rounds: SummaryRound[] = [];

  for (const event of allEvents) {
    const dispatchesForEvent = allDispatches.filter((d) => d.eventId === event.id);
    const scoredDispatches = dispatchesForEvent.filter((d) => d.status === "scored" || d.status === "closed");
    if (scoredDispatches.length === 0) continue;

    const entries: SummaryRoundEntry[] = [];
    for (const dispatch of scoredDispatches) {
      const decision = allDecisions.find((d) => d.eventDispatchId === dispatch.id);
      const team = allTeams.find((t) => t.id === dispatch.targetTeamId);
      const score = decision ? allScores.find((s) => s.decisionId === decision.id) : undefined;
      if (!team) continue;

      entries.push({
        regionId: team.regionId,
        structuredChoice: decision?.structuredChoice ?? null,
        rationaleText: decision?.rationaleText ?? "(no submission — fallback tier auto-applied)",
        resourceAllocationJson: (decision?.resourceAllocationJson as Record<string, number> | null) ?? null,
        coordinatedWithTeamsJson: (decision?.coordinatedWithTeamsJson as string[] | null) ?? null,
        tier: score?.tier ?? null,
        compositePct: score?.compositePct ?? null,
        impactDesc: score ? tierImpactDesc(event, score.tier) : null,
      });
    }

    entries.sort((a, b) => a.regionId.localeCompare(b.regionId));

    rounds.push({
      eventId: event.id,
      title: event.title,
      day: event.day,
      narrativeMarkdown: event.narrativeMarkdown,
      category: event.category,
      entries,
    });
  }

  return rounds;
}

function tierImpactDesc(event: { modelDeltaDesc: string }, tier: string): string {
  return `Tier: ${tier.replace("_", " ")}. ${event.modelDeltaDesc}`;
}

export interface TeamHighlightEntry {
  eventId: string;
  eventTitle: string;
  tier: string;
  compositePct: number;
}

export interface TeamHighlights {
  regionId: string;
  strongest: TeamHighlightEntry[];
  weakest: TeamHighlightEntry[];
}

// Per-team "3 strongest / 3 weakest decisions" — the personalized "week in
// review" artifact called for in simulation-docs/03-events.md's EVT-014
// implementation note, structured around the composite score each decision
// actually received (not just its tier), so ties resolve sensibly.
export async function computeTeamHighlights(): Promise<TeamHighlights[]> {
  const allTeams = await db.query.teams.findMany();
  const allDispatches = await db.query.eventDispatches.findMany();
  const allDecisions = await db.query.decisions.findMany();
  const allScores = await db.query.scores.findMany();
  const allEvents = await db.query.events.findMany();

  return allTeams.map((team) => {
    const entries: TeamHighlightEntry[] = [];
    for (const decision of allDecisions.filter((d) => d.teamId === team.id)) {
      const score = allScores.find((s) => s.decisionId === decision.id);
      if (!score) continue;
      const dispatch = allDispatches.find((d) => d.id === decision.eventDispatchId);
      const event = dispatch ? allEvents.find((e) => e.id === dispatch.eventId) : null;
      if (!event) continue;
      entries.push({ eventId: event.id, eventTitle: event.title, tier: score.tier, compositePct: score.compositePct });
    }

    const sorted = entries.slice().sort((a, b) => b.compositePct - a.compositePct);
    return {
      regionId: team.regionId,
      strongest: sorted.slice(0, 3),
      weakest: sorted.slice(-3).reverse().filter((e) => !sorted.slice(0, 3).includes(e)),
    };
  });
}
