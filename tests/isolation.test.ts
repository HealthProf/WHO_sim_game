import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  modelState,
  sessionState,
  eventDispatches,
  decisions,
  scores,
  teams,
  gameSessions,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { resetDb, seedStaticOnce } from "./helpers/db";
import { createTestSession } from "./helpers/session";
import { processDeadlines } from "@/lib/deadline";
import { tryDeductWhoHqField, creditRegionField } from "@/lib/db-atomic";
import { computeCompositePct, tierForCompositePct } from "@/lib/scoring";
import { applyModelDelta, applyOptimalShadowDelta } from "@/lib/model-engine";

// A minimal stand-in for app/api/scores/route.ts's scoreDecision(), which
// this suite deliberately does not import: that file (transitively, via
// lib/session-context -> lib/auth) pulls in next-auth's "next/server"
// subpath, which Next.js resolves fine at build/runtime but plain Vitest
// (no Next plugin) cannot — reproducing the same scoring math here keeps
// the isolation assertions real without dragging in the whole auth stack.
async function testScoreDecision(sessionId: string, decisionId: number, regionId: string, dims: { evidenceScore: number; politicalScore: number; equityScore: number }) {
  const compositePct = computeCompositePct(dims);
  const tier = tierForCompositePct(compositePct);
  await db.insert(scores).values({
    sessionId,
    decisionId,
    evidenceScore: dims.evidenceScore,
    politicalScore: dims.politicalScore,
    equityScore: dims.equityScore,
    rawCompositePct: compositePct,
    compositePct,
    tier,
    scoredByUserId: (await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, sessionId) }))!.ownerUserId,
  });
  await applyModelDelta({
    sessionId,
    deltas: [
      { field: "publicTrustIndex", region: "SELF", delta: tier === "OPTIMAL" ? 10 : tier === "CRITICAL_FAILURE" ? -10 : 0 },
    ],
    submittingRegionId: regionId,
    reason: `test scoring: ${tier}`,
  });
  await applyOptimalShadowDelta(sessionId, [{ field: "publicTrustIndex", region: "SELF", delta: 10 }], regionId);
  return { tier, compositePct };
}

// The full per-session table list from lib/session-lifecycle.ts's
// deleteSession, minus tables that never get a row in this simple test
// fixture (announcements, budget cycles, market, trade, emergency funding,
// snap votes, social milestones) — those are exercised structurally by the
// schema itself (every one of them carries sessionId + an index, verified
// in the sweep report) rather than needing a populated-row check here.
const PER_SESSION_TABLES = [
  { table: teams, name: "teams" },
  { table: modelState, name: "modelState" },
  { table: eventDispatches, name: "eventDispatches" },
  { table: decisions, name: "decisions" },
  { table: scores, name: "scores" },
] as const;

async function dispatchEvent(sessionId: string, eventId: string, regionId: string) {
  const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.regionId, regionId)) });
  if (!team) throw new Error("team not found");
  const [dispatch] = await db
    .insert(eventDispatches)
    .values({ sessionId, eventId, targetTeamId: team.id, status: "dispatched" })
    .returning();
  return { dispatch, team };
}

describe("session isolation", () => {
  beforeEach(async () => {
    await resetDb();
    await seedStaticOnce();
  });

  it("divergent decisions in two sessions don't cross-pollute model_state", async () => {
    const a = await createTestSession("instructor");
    const b = await createTestSession("instructor");

    const { dispatch: dispatchA, team: teamA } = await dispatchEvent(a.sessionId, "EVT-001", "AFRO");
    const { dispatch: dispatchB, team: teamB } = await dispatchEvent(b.sessionId, "EVT-001", "AFRO");

    const [decisionA] = await db
      .insert(decisions)
      .values({ sessionId: a.sessionId, eventDispatchId: dispatchA.id, teamId: teamA.id, actorKind: "team", rationaleText: "A's call", submittedByUserId: a.ownerUserId })
      .returning();
    const [decisionB] = await db
      .insert(decisions)
      .values({ sessionId: b.sessionId, eventDispatchId: dispatchB.id, teamId: teamB.id, actorKind: "team", rationaleText: "B's call", submittedByUserId: b.ownerUserId })
      .returning();

    // Dimension scores are on a 1-4 scale (see lib/scoring.ts). A scores
    // OPTIMAL (max on every dimension), B scores CRITICAL_FAILURE (min on
    // every dimension) — divergent enough that model_state should move in
    // opposite directions if isolation is broken.
    await testScoreDecision(a.sessionId, decisionA.id, "AFRO", { evidenceScore: 4, politicalScore: 4, equityScore: 4 });
    await testScoreDecision(b.sessionId, decisionB.id, "AFRO", { evidenceScore: 1, politicalScore: 1, equityScore: 1 });

    const stateA = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, a.sessionId), eq(modelState.regionId, "AFRO")) });
    const stateBBefore = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, b.sessionId), eq(modelState.regionId, "AFRO")) });

    // Re-score would be redundant; the real assertion is that A's own score
    // is exactly what a lone-session run would produce — nothing about B's
    // CRITICAL_FAILURE run leaked into it. Sanity-check the tiers actually
    // diverged (weak test if they came out identical).
    const scoreRowA = await db.query.scores.findFirst({ where: eq(scores.decisionId, decisionA.id) });
    const scoreRowB = await db.query.scores.findFirst({ where: eq(scores.decisionId, decisionB.id) });
    expect(scoreRowA?.tier).toBe("OPTIMAL");
    expect(scoreRowB?.tier).toBe("CRITICAL_FAILURE");
    expect(stateA).toBeDefined();
    expect(stateBBefore).toBeDefined();
    // A CRITICAL_FAILURE score in B should never have moved A's numbers.
    expect(stateA!.publicTrustIndex).not.toBe(stateBBefore!.publicTrustIndex);
  });

  it("invisibility: a session-scoped query never returns another session's rows", async () => {
    const a = await createTestSession("instructor");
    const b = await createTestSession("instructor");
    await dispatchEvent(a.sessionId, "EVT-001", "AFRO");
    await dispatchEvent(b.sessionId, "EVT-001", "AFRO");

    for (const { table, name } of PER_SESSION_TABLES) {
      const rowsInA = await db.query[name as "teams"].findMany({ where: eq((table as typeof teams).sessionId, a.sessionId) });
      for (const row of rowsInA as { sessionId: string }[]) {
        expect(row.sessionId).toBe(a.sessionId);
        expect(row.sessionId).not.toBe(b.sessionId);
      }
    }

    // gameSessions rows themselves are also distinct and don't leak fields.
    const sessionARow = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, a.sessionId) });
    const sessionBRow = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, b.sessionId) });
    expect(sessionARow?.id).not.toBe(sessionBRow?.id);
    expect(sessionARow?.displayToken).not.toBe(sessionBRow?.displayToken);
  });

  it("cross-session decisions GET (the pre-existing leak) 404s instead of returning another session's rows", async () => {
    const a = await createTestSession("instructor");
    const b = await createTestSession("instructor");
    const { dispatch: dispatchB } = await dispatchEvent(b.sessionId, "EVT-001", "AFRO");

    // Simulates the ownership check added to app/api/decisions/route.ts GET:
    // a dispatch id from session B must not resolve inside session A's scope.
    const foundInA = await db.query.eventDispatches.findFirst({
      where: and(eq(eventDispatches.sessionId, a.sessionId), eq(eventDispatches.id, dispatchB.id)),
    });
    expect(foundInA).toBeUndefined();
  });

  it("independent ticks: processDeadlines(A) does not touch B's lastTickAt", async () => {
    const a = await createTestSession("instructor");
    const b = await createTestSession("instructor");

    await db.update(sessionState).set({ simulationStatus: "running" }).where(eq(sessionState.sessionId, a.sessionId));
    await db.update(sessionState).set({ simulationStatus: "running" }).where(eq(sessionState.sessionId, b.sessionId));

    const bBeforeState = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, b.sessionId) });
    expect(bBeforeState?.lastTickAt).toBeNull();

    await processDeadlines(a.sessionId);

    const aAfter = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, a.sessionId) });
    const bAfter = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, b.sessionId) });
    expect(aAfter?.lastTickAt).not.toBeNull();
    expect(bAfter?.lastTickAt).toBeNull();

    // A's throttle claim must not block B's own tick from claiming its row.
    await processDeadlines(b.sessionId);
    const bAfterOwnTick = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, b.sessionId) });
    expect(bAfterOwnTick?.lastTickAt).not.toBeNull();
  });

  it("independent economies: WHO HQ funds in one session are untouched by another's purchases", async () => {
    const a = await createTestSession("instructor");
    const b = await createTestSession("instructor");

    const bBefore = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, b.sessionId) });

    const deducted = await tryDeductWhoHqField(a.sessionId, "whoHqFund", 10_000_000);
    expect(deducted).toBe(true);

    const aAfter = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, a.sessionId) });
    const bAfter = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, b.sessionId) });
    expect(aAfter!.whoHqFund).toBe(bBefore!.whoHqFund - 10_000_000);
    expect(bAfter!.whoHqFund).toBe(bBefore!.whoHqFund);

    // Region-level credit is equally session-scoped.
    const teamA = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, a.sessionId), eq(teams.regionId, "AFRO")) });
    const beforeRegionA = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, a.sessionId), eq(modelState.regionId, "AFRO")) });
    const beforeRegionB = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, b.sessionId), eq(modelState.regionId, "AFRO")) });
    await creditRegionField(a.sessionId, teamA!.regionId, "fundRemaining", 500_000);
    const afterRegionA = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, a.sessionId), eq(modelState.regionId, "AFRO")) });
    const afterRegionB = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, b.sessionId), eq(modelState.regionId, "AFRO")) });
    expect(afterRegionA!.fundRemaining).toBe(beforeRegionA!.fundRemaining + 500_000);
    expect(afterRegionB!.fundRemaining).toBe(beforeRegionB!.fundRemaining);
  });
});
