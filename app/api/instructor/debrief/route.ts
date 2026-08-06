import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eventDispatches, decisions, teams, modelStateHistory, scores, resourcePledges } from "@/lib/db/schema";
import { and, eq, inArray, asc } from "drizzle-orm";
import { requireInstructorActor } from "@/lib/session-context";
import { computeTeamHighlights } from "@/lib/summary-report";
import { computeFinalResults } from "@/lib/final-results";
import { computeAllTeamChapters } from "@/lib/team-chapter";

// After-action debrief artifacts per simulation-docs/03-events.md EVT-014/
// EVT-016 implementation notes and 05-product-requirements.md §10: model
// state trajectory (from the append-only history, never just current
// snapshot), and the EVT-006-vs-EVT-012 allocation comparison as a
// first-class artifact.
export async function GET() {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const history = await db.query.modelStateHistory.findMany({
    where: eq(modelStateHistory.sessionId, sessionId),
    orderBy: asc(modelStateHistory.createdAt),
  });

  const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });

  async function allocationsFor(eventId: string) {
    const dispatches = await db.query.eventDispatches.findMany({ where: and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.eventId, eventId)) });
    const dispatchIds = dispatches.map((d) => d.id);
    const decisionsForDispatches =
      dispatchIds.length > 0 ? await db.query.decisions.findMany({ where: and(eq(decisions.sessionId, sessionId), inArray(decisions.eventDispatchId, dispatchIds)) }) : [];
    return dispatches.map((d) => {
      const decision = decisionsForDispatches.find((dec) => dec.eventDispatchId === d.id);
      const team = allTeams.find((t) => t.id === d.targetTeamId);
      return { regionId: team?.regionId ?? "?", allocation: (decision?.resourceAllocationJson as Record<string, number>) ?? null };
    });
  }

  const evt006 = await allocationsFor("EVT-006");
  const evt012 = await allocationsFor("EVT-012");

  const allScores = await db.query.scores.findMany({ where: eq(scores.sessionId, sessionId) });
  const allDecisions = await db.query.decisions.findMany({ where: eq(decisions.sessionId, sessionId) });
  const mostConsequential = allScores
    .filter((s) => s.tier === "CRITICAL_FAILURE" || s.tier === "OPTIMAL")
    .map((s) => {
      const decision = allDecisions.find((d) => d.id === s.decisionId);
      return { score: s, decision };
    })
    .slice(0, 10);

  const teamHighlights = await computeTeamHighlights(sessionId);

  const allPledges = await db.query.resourcePledges.findMany({ where: eq(resourcePledges.sessionId, sessionId) });
  const pledgeTotals: Record<string, { given: number; received: number }> = {};
  for (const t of allTeams) pledgeTotals[t.regionId] = { given: 0, received: 0 };
  for (const p of allPledges) {
    const fromRegion = allTeams.find((t) => t.id === p.fromTeamId)?.regionId;
    const toRegion = allTeams.find((t) => t.id === p.toTeamId)?.regionId;
    if (fromRegion) pledgeTotals[fromRegion].given += 1;
    if (toRegion) pledgeTotals[toRegion].received += 1;
  }

  const finalResults = await computeFinalResults(sessionId);
  const teamChapters = await computeAllTeamChapters(sessionId);

  return NextResponse.json({
    modelStateHistory: history,
    evt006Allocations: evt006,
    evt012Allocations: evt012,
    mostConsequentialScores: mostConsequential,
    teamHighlights,
    pledgeTotals,
    finalResults,
    teamChapters,
  });
}
