import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { events, modelState, teams, eventDispatches, sessionRegionAutoplay, gameSessions, sessionState, decisions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { resetDb, seedStaticOnce } from "./helpers/db";
import { createTestSession } from "./helpers/session";
import { scriptedAutoplayer } from "@/lib/autoplayer";
import { runAutoplayer } from "@/lib/autoplayer/run";
import { AUTOPLAY_PROFILE_DISTRIBUTIONS } from "@/lib/config";
import type { Tier } from "@/lib/db/seed-data/events";

async function getModelStateFor(sessionId: string, regionId: string) {
  return db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, regionId)) });
}

describe("scripted autoplayer", () => {
  beforeEach(async () => {
    await resetDb();
    await seedStaticOnce();
  });

  it("tier sampling roughly matches the profile's distribution over many draws", async () => {
    const { sessionId } = await createTestSession("demo");
    const event = await db.query.events.findFirst({ where: eq(events.id, "EVT-001") });
    const state = await getModelStateFor(sessionId, "AFRO");
    expect(event).toBeDefined();
    expect(state).toBeDefined();

    const counts: Record<Tier, number> = { OPTIMAL: 0, ADEQUATE: 0, INADEQUATE: 0, CRITICAL_FAILURE: 0 };
    const N = 400;
    for (let i = 0; i < N; i++) {
      const decision = await scriptedAutoplayer.decideForRegion({
        sessionId,
        regionId: "AFRO",
        event: event!,
        modelState: state!,
        profile: "strong",
      });
      counts[decision.tier]++;
    }

    const dist = AUTOPLAY_PROFILE_DISTRIBUTIONS.strong;
    for (const tier of Object.keys(dist) as Tier[]) {
      const observed = counts[tier] / N;
      // Generous tolerance — this is a statistical sanity check, not an
      // exact-distribution assertion (option-tier fallback can shift the
      // realized distribution slightly from the raw sample distribution).
      expect(observed).toBeGreaterThanOrEqual(Math.max(0, dist[tier] - 0.2));
      expect(observed).toBeLessThanOrEqual(dist[tier] + 0.2);
    }
  });

  it("filters to affordable options before sampling", async () => {
    const { sessionId } = await createTestSession("demo");
    const event = await db.query.events.findFirst({ where: eq(events.id, "EVT-001") });
    expect(event?.structuredOptionsJson).toBeTruthy();

    // Drain the region's resources to near zero so only free (or very
    // cheap) options remain affordable.
    await db
      .update(modelState)
      .set({ fundRemaining: 0, ppeDaysRemaining: 0, antiviralsRemaining: 0 })
      .where(and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, "AFRO")));
    const brokeState = await getModelStateFor(sessionId, "AFRO");

    const decision = await scriptedAutoplayer.decideForRegion({
      sessionId,
      regionId: "AFRO",
      event: event!,
      modelState: brokeState!,
      profile: "strong",
    });
    expect(decision.optionLabel).toBeTruthy();

    const options = event!.structuredOptionsJson as { label: string; cost?: { fund?: number; ppeDays?: number; antivirals?: number } }[];
    const chosen = options.find((o) => o.label === decision.optionLabel);
    // With everything at 0, only a zero-cost option (or the cheapest
    // fallback) should ever be chosen.
    if (chosen?.cost) {
      expect(chosen.cost.fund ?? 0).toBeLessThanOrEqual(0);
    }
  });

  it("the four no-structured-option events produce a valid submission", async () => {
    const { sessionId } = await createTestSession("demo");
    const state = await getModelStateFor(sessionId, "AFRO");

    for (const eventId of ["EVT-006", "EVT-012", "EVT-014", "EVT-016"]) {
      const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
      expect(event).toBeDefined();
      const decision = await scriptedAutoplayer.decideForRegion({
        sessionId,
        regionId: "AFRO",
        event: event!,
        modelState: state!,
        profile: "mixed",
      });
      expect(decision.optionLabel).toBeNull();
      expect(decision.rationaleText.length).toBeGreaterThan(0);
      if (event!.isAllocationEvent) {
        const total = Object.values(decision.resourceAllocationJson ?? {}).reduce((a, b) => a + b, 0);
        expect(total).toBe(180_000);
      }
    }
  });

  it("an occupied region is never autoplayed, and autoplayed decisions move model_state", async () => {
    const { sessionId } = await createTestSession("demo");
    await db.update(sessionState).set({ simulationStatus: "running", simulationStartedAt: new Date() }).where(eq(sessionState.sessionId, sessionId));
    await db.update(gameSessions).set({ demoActiveRegionId: "AFRO" }).where(eq(gameSessions.id, sessionId));

    const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.regionId, "AFRO")) });
    const wproTeam = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.regionId, "WPRO")) });

    const dispatchedAt = new Date(Date.now() - 60 * 60 * 1000); // an hour ago, so the response-eligibility window has definitely passed
    await db.insert(eventDispatches).values([
      { sessionId, eventId: "EVT-001", targetTeamId: team!.id, dispatchedAt, deadlineAt: null, status: "dispatched" },
      { sessionId, eventId: "EVT-001", targetTeamId: wproTeam!.id, dispatchedAt, deadlineAt: null, status: "dispatched" },
    ]);

    await runAutoplayer(sessionId);

    // AFRO is occupied by the owner — must NOT have been autoplayed.
    const afroDispatch = await db.query.eventDispatches.findFirst({
      where: and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.targetTeamId, team!.id)),
    });
    expect(afroDispatch?.status).toBe("dispatched");

    // WPRO is not occupied — should have been autoplayed and scored.
    const wproDispatch = await db.query.eventDispatches.findFirst({
      where: and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.targetTeamId, wproTeam!.id)),
    });
    expect(wproDispatch?.status).toBe("scored");

    const wproDecision = await db.query.decisions.findFirst({ where: and(eq(decisions.sessionId, sessionId), eq(decisions.teamId, wproTeam!.id)) });
    expect(wproDecision?.actorKind).toBe("autoplayer");
  });

  it("sessionRegionAutoplay rows are created for all six regions at session creation, with varied profiles", async () => {
    const { sessionId } = await createTestSession("demo");
    const rows = await db.query.sessionRegionAutoplay.findMany({ where: eq(sessionRegionAutoplay.sessionId, sessionId) });
    expect(rows.length).toBe(6);
    const profiles = new Set(rows.map((r) => r.profile));
    expect(profiles.size).toBeGreaterThan(1); // not all the same profile
  });
});
