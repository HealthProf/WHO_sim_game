import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  decisions,
  emergencyFundingRequests,
  emergencyFundingContributions,
  eventDispatches,
  gameSessions,
  marketRequests,
  scores,
  sessionState,
  teams,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { resetDb, seedStaticOnce } from "./helpers/db";
import { createTestSession } from "./helpers/session";
import { runAutoplayer } from "@/lib/autoplayer/run";
import { stressAdjustedDistribution, profileAllocation } from "@/lib/autoplayer/scripted";
import { stableFraction } from "@/lib/autoplayer/economy";
import { gradeDecision } from "@/lib/auto-grade";
import { saveRegionSetup, getRegionSetup } from "@/lib/region-setup";
import { submitDecision } from "@/lib/decisions";
import { REGIONS } from "@/lib/regions";

const MIN = 60_000;

describe("computer player variety (pure)", () => {
  it("stress shifts probability toward worse calls, thriving toward better, and stays a distribution", () => {
    const base = stressAdjustedDistribution("mixed");
    const stressed = stressAdjustedDistribution("mixed", { publicTrustIndex: 30, populationHappinessIndex: 60 });
    const thriving = stressAdjustedDistribution("mixed", { publicTrustIndex: 85, populationHappinessIndex: 60 });
    for (const d of [base, stressed, thriving]) expect(Object.values(d).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(stressed.OPTIMAL).toBeLessThan(base.OPTIMAL);
    expect(stressed.CRITICAL_FAILURE).toBeGreaterThan(base.CRITICAL_FAILURE);
    expect(thriving.OPTIMAL).toBeGreaterThan(base.OPTIMAL);
  });

  it("allocation styles sum exactly and grade the way the authored criteria say", () => {
    const grade = (profile: "strong" | "mixed" | "struggling") => {
      const alloc = profileAllocation(profile, {}, () => 0.5);
      expect(Object.values(alloc).reduce((a, b) => a + b, 0)).toBe(180_000);
      return gradeDecision({
        event: { id: "EVT-006", minRationaleWords: 0, isAllocationEvent: true, requiresMandatoryReview: false, structuredOptionsJson: null },
        decision: { structuredChoice: null, rationaleText: "", resourceAllocationJson: alloc },
      }).tier;
    };
    expect(grade("strong")).toBe("OPTIMAL");
    expect(grade("struggling")).toBe("INADEQUATE");
  });

  it("stable per-game randomness doesn't re-roll", () => {
    expect(stableFraction("abc:EVT-007")).toBe(stableFraction("abc:EVT-007"));
    expect(stableFraction("abc:EVT-007")).not.toBe(stableFraction("abd:EVT-007"));
  });
});

async function startRunning(sessionId: string, minutesAgo: number) {
  await db
    .update(sessionState)
    .set({ simulationStatus: "running", simulationStartedAt: new Date(Date.now() - minutesAgo * MIN) })
    .where(eq(sessionState.sessionId, sessionId));
}

describe("class sessions with computer-run regions", () => {
  beforeEach(async () => {
    await resetDb();
    await seedStaticOnce();
  });

  it("only the regions marked computer are played, and only in that session", async () => {
    const a = await createTestSession("instructor");
    const b = await createTestSession("instructor");
    await saveRegionSetup(a.sessionId, REGIONS.map((r) => ({ regionId: r, computer: r === "AFRO", profile: "strong" as const })));
    expect((await getRegionSetup(a.sessionId)).filter((r) => r.computer).map((r) => r.regionId)).toEqual(["AFRO"]);
    expect((await getRegionSetup(b.sessionId)).some((r) => r.computer)).toBe(false);

    const longAgo = new Date(Date.now() - 60 * MIN);
    for (const s of [a, b]) {
      await startRunning(s.sessionId, 5);
      const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, s.sessionId) });
      await db.insert(eventDispatches).values(
        allTeams.map((t) => ({ sessionId: s.sessionId, eventId: "EVT-001", targetTeamId: t.id, dispatchedAt: longAgo, deadlineAt: null, status: "dispatched" as const }))
      );
    }
    await runAutoplayer(a.sessionId);
    await runAutoplayer(b.sessionId);

    const statusFor = async (sessionId: string, regionId: string) => {
      const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.regionId, regionId)) });
      return (await db.query.eventDispatches.findFirst({ where: and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.targetTeamId, team!.id)) }))!.status;
    };
    expect(await statusFor(a.sessionId, "AFRO")).toBe("scored");
    expect(await statusFor(a.sessionId, "EURO")).toBe("dispatched");
    expect(await statusFor(b.sessionId, "AFRO")).toBe("dispatched");
  });
});

describe("solo play: computer facilitator", () => {
  beforeEach(async () => {
    await resetDb();
    await seedStaticOnce();
  });

  async function soloRegionGame(regionId = "AMRO") {
    const s = await createTestSession("demo");
    await db.update(gameSessions).set({ soloRole: "region", demoActiveRegionId: regionId }).where(eq(gameSessions.id, s.sessionId));
    await db.update(sessionState).set({ computerFacilitator: true }).where(eq(sessionState.sessionId, s.sessionId));
    await startRunning(s.sessionId, 1);
    return s;
  }

  it("fires the first required event, and a facilitator-run solo game fires nothing on its own", async () => {
    const comp = await soloRegionGame();
    const human = await createTestSession("demo");
    await db.update(gameSessions).set({ soloRole: "facilitator" }).where(eq(gameSessions.id, human.sessionId));
    await db.update(sessionState).set({ computerFacilitator: false }).where(eq(sessionState.sessionId, human.sessionId));
    await startRunning(human.sessionId, 1);

    await runAutoplayer(comp.sessionId);
    await runAutoplayer(human.sessionId);
    const fired = async (sid: string) => new Set((await db.query.eventDispatches.findMany({ where: eq(eventDispatches.sessionId, sid) })).map((d) => d.eventId));
    expect([...(await fired(comp.sessionId))]).toEqual(["EVT-001"]);
    expect((await fired(human.sessionId)).size).toBe(0);
  });

  it("grades the human player's submission after a short delay, never the computer regions'", async () => {
    const s = await soloRegionGame("AMRO");
    await runAutoplayer(s.sessionId); // fires EVT-001
    const amro = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, s.sessionId), eq(teams.regionId, "AMRO")) });
    const dispatch = await db.query.eventDispatches.findFirst({
      where: and(eq(eventDispatches.sessionId, s.sessionId), eq(eventDispatches.targetTeamId, amro!.id)),
    });
    const res = await submitDecision({
      sessionId: s.sessionId,
      teamId: amro!.id,
      eventDispatchId: dispatch!.id,
      structuredChoice: "A",
      rationaleText: "Evidence on transmission supports declaring; politically feasible with partners; protects vulnerable regions.",
      confidenceLevel: "MEDIUM",
      actor: { kind: "owner", userId: s.ownerUserId },
    });
    if ("error" in res) throw new Error(res.error);

    await runAutoplayer(s.sessionId);
    expect(await db.query.scores.findFirst({ where: eq(scores.decisionId, res.decision.id) })).toBeUndefined(); // still inside the delay

    // Age the submission past the delay.
    await db.update(decisions).set({ submittedAt: new Date(Date.now() - MIN) }).where(eq(decisions.id, res.decision.id));
    await runAutoplayer(s.sessionId);
    const score = await db.query.scores.findFirst({ where: eq(scores.decisionId, res.decision.id) });
    expect(score?.tier).toBeTruthy();
  });

  it("approves WHO HQ purchases after the heads-up window and handles funding requests", async () => {
    const s = await soloRegionGame("AMRO");
    const amro = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, s.sessionId), eq(teams.regionId, "AMRO")) });
    const [req] = await db
      .insert(marketRequests)
      .values({ sessionId: s.sessionId, teamId: amro!.id, resourceType: "PPE_DAYS", amount: 2, pricePerUnit: 1000, totalCost: 2000, createdAt: new Date(Date.now() - MIN) })
      .returning();
    const [fund] = await db
      .insert(emergencyFundingRequests)
      .values({ sessionId: s.sessionId, requestingTeamId: amro!.id, amountRequested: 10_000_000, reason: "test", createdAt: new Date(Date.now() - 3 * MIN) })
      .returning();

    await runAutoplayer(s.sessionId);

    expect((await db.query.marketRequests.findFirst({ where: eq(marketRequests.id, req.id) }))!.status).toBe("approved");
    const contribs = await db.query.emergencyFundingContributions.findMany({ where: eq(emergencyFundingContributions.requestId, fund.id) });
    const whoHq = contribs.find((c) => c.isWhoHq);
    expect(whoHq!.amount).toBeGreaterThanOrEqual(3_000_000);
    expect(whoHq!.amount).toBeLessThanOrEqual(6_000_000);
    expect((await db.query.emergencyFundingRequests.findFirst({ where: eq(emergencyFundingRequests.id, fund.id) }))!.status).toBe("closed");
  });

  it("doesn't end the game when the story clock runs out with required events still unreleased", async () => {
    const s = await soloRegionGame("AMRO");
    await startRunning(s.sessionId, 500); // far past the end of the story
    await runAutoplayer(s.sessionId);
    const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, s.sessionId) });
    expect(gs!.simulationStatus).toBe("running");
    // It keeps releasing the overdue required events instead.
    expect((await db.query.eventDispatches.findMany({ where: eq(eventDispatches.sessionId, s.sessionId) })).length).toBeGreaterThan(0);
  });
});
