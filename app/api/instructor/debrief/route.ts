import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eventDispatches, decisions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireInstructor } from "@/lib/api-helpers";
import { computeTeamHighlights } from "@/lib/summary-report";

// After-action debrief artifacts per simulation-docs/03-events.md EVT-014/
// EVT-016 implementation notes and 05-product-requirements.md §10: model
// state trajectory (from the append-only history, never just current
// snapshot), and the EVT-006-vs-EVT-012 allocation comparison as a
// first-class artifact.
export async function GET() {
  const { error } = await requireInstructor();
  if (error) return error;

  const history = await db.query.modelStateHistory.findMany({
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  const allTeams = await db.query.teams.findMany();

  async function allocationsFor(eventId: string) {
    const dispatches = await db.query.eventDispatches.findMany({ where: eq(eventDispatches.eventId, eventId) });
    const out: { regionId: string; allocation: Record<string, number> | null }[] = [];
    for (const d of dispatches) {
      const decision = await db.query.decisions.findFirst({ where: eq(decisions.eventDispatchId, d.id) });
      const team = allTeams.find((t) => t.id === d.targetTeamId);
      out.push({ regionId: team?.regionId ?? "?", allocation: (decision?.resourceAllocationJson as Record<string, number>) ?? null });
    }
    return out;
  }

  const evt006 = await allocationsFor("EVT-006");
  const evt012 = await allocationsFor("EVT-012");

  const allScores = await db.query.scores.findMany();
  const allDecisions = await db.query.decisions.findMany();
  const mostConsequential = allScores
    .filter((s) => s.tier === "CRITICAL_FAILURE" || s.tier === "OPTIMAL")
    .map((s) => {
      const decision = allDecisions.find((d) => d.id === s.decisionId);
      return { score: s, decision };
    })
    .slice(0, 10);

  const teamHighlights = await computeTeamHighlights();

  const allPledges = await db.query.resourcePledges.findMany();
  const pledgeTotals: Record<string, { given: number; received: number }> = {};
  for (const t of allTeams) pledgeTotals[t.regionId] = { given: 0, received: 0 };
  for (const p of allPledges) {
    const fromRegion = allTeams.find((t) => t.id === p.fromTeamId)?.regionId;
    const toRegion = allTeams.find((t) => t.id === p.toTeamId)?.regionId;
    if (fromRegion) pledgeTotals[fromRegion].given += 1;
    if (toRegion) pledgeTotals[toRegion].received += 1;
  }

  return NextResponse.json({
    modelStateHistory: history,
    evt006Allocations: evt006,
    evt012Allocations: evt012,
    mostConsequentialScores: mostConsequential,
    teamHighlights,
    pledgeTotals,
  });
}
