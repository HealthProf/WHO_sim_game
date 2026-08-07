// Captures a non-demo session's final outcomes — per-region confirmed
// cases, deaths, resources, social metrics, and the actual-vs-optimal
// comparison (lib/final-results.ts) — into game_session_snapshots before
// lib/reaper.ts deletes the session's live rows for good. See that table's
// comment in lib/db/schema.ts for why this needs to exist at all: an
// archived instructor session (and everything it owns) is deleted
// REAP_DELETE_INSTRUCTOR_AFTER_ARCHIVE_HOURS after archiving, which is
// well before anyone gets around to analyzing engagement data.
//
// Called from two places, upserted on sessionId so either can supersede the
// other with the latest numbers:
//   1. PATCH /api/instructor/simulation, when the instructor marks the
//      simulation "completed" — the common, intentional path.
//   2. lib/reaper.ts, right before it deletes an archived session that was
//      never explicitly completed — a safety net so an idle-timeout session
//      still gets its final state preserved.
import { db } from "./db";
import { gameSessions, sessionState, modelState, teams, gameSessionSnapshots } from "./db/schema";
import { eq, sql } from "drizzle-orm";
import { computeFinalResults } from "./final-results";

export async function captureFinalSnapshot(sessionId: string, reason: "completed" | "reaped"): Promise<void> {
  const session = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, sessionId) });
  if (!session || session.mode === "demo") return;

  const state = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  if (!state) return;

  const [regionStates, finalResults, [{ teamCount }]] = await Promise.all([
    db.query.modelState.findMany({ where: eq(modelState.sessionId, sessionId) }),
    computeFinalResults(sessionId),
    db.select({ teamCount: sql<number>`count(*)::int` }).from(teams).where(eq(teams.sessionId, sessionId)),
  ]);

  const regionResultsJson = regionStates.map((r) => {
    const final = finalResults.regions.find((f) => f.regionId === r.regionId);
    return {
      regionId: r.regionId,
      rt: r.rt,
      confirmedCases: r.confirmedCases,
      estimatedTrueCasesLow: r.estimatedTrueCasesLow,
      estimatedTrueCasesHigh: r.estimatedTrueCasesHigh,
      deaths: r.deaths,
      hospitalCapacityPct: r.hospitalCapacityPct,
      surveillanceIndex: r.surveillanceIndex,
      fundRemaining: r.fundRemaining,
      ppeDaysRemaining: r.ppeDaysRemaining,
      antiviralsRemaining: r.antiviralsRemaining,
      hcwSurgePct: r.hcwSurgePct,
      politicalTensionIndex: r.politicalTensionIndex,
      publicTrustIndex: r.publicTrustIndex,
      populationHappinessIndex: r.populationHappinessIndex,
      optimalConfirmed: final?.optimalConfirmed ?? null,
      optimalDeaths: final?.optimalDeaths ?? null,
      infectionsPrevented: final?.infectionsPrevented ?? null,
      deathsPrevented: final?.deathsPrevented ?? null,
    };
  });

  const values = {
    sessionId,
    reason,
    sessionCreatedAt: session.createdAt,
    currentDay: state.currentDay,
    totalGameDays: state.totalGameDays,
    escalationState: state.escalationState,
    mediaPressureIndex: state.mediaPressureIndex,
    whoHqFund: state.whoHqFund,
    whoHqPpeStock: state.whoHqPpeStock,
    whoHqAntiviralsStock: state.whoHqAntiviralsStock,
    teamCount,
    regionResultsJson,
    totalActualConfirmed: finalResults.totalActualConfirmed,
    totalActualDeaths: finalResults.totalActualDeaths,
    totalOptimalConfirmed: finalResults.totalOptimalConfirmed,
    totalOptimalDeaths: finalResults.totalOptimalDeaths,
    totalInfectionsPrevented: finalResults.totalInfectionsPrevented,
    totalDeathsPrevented: finalResults.totalDeathsPrevented,
  };

  try {
    await db
      .insert(gameSessionSnapshots)
      .values(values)
      .onConflictDoUpdate({ target: gameSessionSnapshots.sessionId, set: values });
  } catch (err) {
    console.error(`captureFinalSnapshot(${sessionId}) failed:`, err);
  }
}
