import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { eventDispatches, sessionState, teams } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resetDb, seedStaticOnce } from "./helpers/db";
import { createTestSession } from "./helpers/session";
import { computeSimClock, type GlobalClockFields } from "@/lib/sim-clock";
import { planDurationChange } from "@/lib/game-duration";
import { buildSchedule, computePacing, type PacingEvent } from "@/lib/pacing";
import { decisionWindowMinutes } from "@/lib/decision-window";
import { rescaleOpenDeadlines, extendOpenDeadlines } from "@/lib/decision-time";
import { runAutopilot } from "@/lib/autopilot";
import { dispatchEventToRegions } from "@/lib/dispatch";
import { eventSeed } from "@/lib/db/seed-data/events";

const MIN = 60_000;

function clockStartedMinutesAgo(minutes: number, rate: number, now: number): GlobalClockFields {
  return {
    simulationStatus: "running",
    simulationStartedAt: new Date(now - minutes * MIN),
    pausedAccumulatedMs: 0,
    pausedAt: null,
    gameDaysPerRealMinute: rate,
    totalGameDays: 90,
    clockAnchorElapsedMs: 0,
    clockAnchorGameDays: 0,
  };
}

describe("game duration", () => {
  it("re-anchors a mid-game change so the in-game day does not jump", () => {
    const now = Date.now();
    const gs = clockStartedMinutesAgo(30, 90 / 75, now); // 30 min into a 75-min game
    const before = computeSimClock(gs, now);

    const update = planDurationChange(gs, 90, now);
    const after = computeSimClock({ ...gs, ...update }, now);
    expect(after.gameDay).toBe(before.gameDay);

    // Remaining 54 game days now spread over the remaining 60 minutes.
    expect(update.gameDaysPerRealMinute).toBeCloseTo(54 / 60, 5);
    const atEnd = computeSimClock({ ...gs, ...update }, now + 60 * MIN - 1000);
    expect(atEnd.gameDay).toBe(90);
  });

  it("before the game starts just sets the single-rate pace", () => {
    const gs = { ...clockStartedMinutesAgo(0, 1.5, Date.now()), simulationStartedAt: null };
    const update = planDurationChange(gs, 75);
    expect(update).toMatchObject({ targetDurationMinutes: 75, clockAnchorElapsedMs: 0, clockAnchorGameDays: 0 });
    expect(update.gameDaysPerRealMinute).toBeCloseTo(1.2, 5);
  });

  it("never leaves less than the minimum remaining time when shrunk below elapsed", () => {
    const now = Date.now();
    const gs = clockStartedMinutesAgo(50, 90 / 75, now);
    const update = planDurationChange(gs, 20, now); // already past 20 min
    const remainingDays = 90 - update.clockAnchorGameDays;
    expect(remainingDays / update.gameDaysPerRealMinute).toBeCloseTo(5, 5);
  });
});

describe("decision windows", () => {
  it("class sessions give seeded 2-6 hour events 7-11 minutes at 1x", () => {
    const gs = { fastModeMultiplier: 1 / 60, decisionWindowBaseMinutes: 5, decisionTimeMultiplier: 1 };
    expect(decisionWindowMinutes(2, gs)).toBeCloseTo(7);
    expect(decisionWindowMinutes(6, gs)).toBeCloseTo(11);
    expect(decisionWindowMinutes(4, { ...gs, decisionTimeMultiplier: 1.5 })).toBeCloseTo(13.5);
  });

  it("demo sessions keep their existing pace", () => {
    expect(decisionWindowMinutes(4, { fastModeMultiplier: 1 / 240, decisionWindowBaseMinutes: 0, decisionTimeMultiplier: 1 })).toBeCloseTo(1);
  });
});

const pacingEvents: PacingEvent[] = eventSeed.map((e) => ({
  id: e.id,
  title: e.title,
  day: e.day,
  isCorePath: e.isCorePath,
  suggestedTargetRegions: e.suggestedTargetRegions,
}));
const allOk = Object.fromEntries(pacingEvents.map((e) => [e.id, { ok: true, blockedBy: [] as string[] }]));

describe("pacing recommender", () => {
  it("spreads each act's required events evenly across the story", () => {
    const schedule = buildSchedule(pacingEvents);
    expect(schedule.length).toBe(pacingEvents.filter((e) => e.isCorePath).length);
    expect(schedule[0]).toMatchObject({ fraction: 0 });
    for (let i = 1; i < schedule.length; i++) expect(schedule[i].fraction).toBeGreaterThan(schedule[i - 1].fraction);
    expect(schedule.every((s) => s.fraction < 1)).toBe(true);
  });

  it("flags 'behind' and recommends the overdue required event", () => {
    const now = Date.now();
    const p = computePacing({ events: pacingEvents, dispatches: [], chainStatus: allOk, clock: clockStartedMinutesAgo(10, 1.2, now), now });
    expect(p.status).toBe("behind");
    expect(p.next?.eventId).toBe("EVT-001");
    expect(p.optional).toHaveLength(0); // no optional suggestions while behind
  });

  it("looks past a blocked event and says scoring is the blocker", () => {
    const now = Date.now();
    const chainStatus = { ...allOk, "EVT-002": { ok: false, blockedBy: ["EVT-001"] }, "EVT-003": { ok: false, blockedBy: ["EVT-001"] } };
    const dispatches = [{ eventId: "EVT-001", status: "responded", targetTeamId: 1 }];
    const p = computePacing({ events: pacingEvents, dispatches, chainStatus, clock: clockStartedMinutesAgo(12, 1.2, now), now });
    expect(p.next?.eventId).not.toBe("EVT-002");
    expect(p.next?.eventId).not.toBe("EVT-003");
    expect(p.blockedNote).toContain("score EVT-001");
  });

  it("warns, but does not block, when teams are at the soft open-event limit", () => {
    const now = Date.now();
    const dispatches = [
      { eventId: "EVT-001", status: "dispatched", targetTeamId: 1 },
      { eventId: "EVT-002", status: "dispatched", targetTeamId: 1 },
    ];
    const p = computePacing({ events: pacingEvents, dispatches, chainStatus: allOk, clock: clockStartedMinutesAgo(20, 1.2, now), now });
    expect(p.next).not.toBeNull();
    expect(p.next!.reason).toContain("already have 2 open events");
  });
});

describe("open-event deadline adjustments and autopilot (DB)", () => {
  beforeEach(async () => {
    await resetDb();
    await seedStaticOnce();
  });

  it("rescales and extends only the target session's open events", async () => {
    const a = await createTestSession("instructor");
    const b = await createTestSession("instructor");
    for (const s of [a, b]) {
      const r = await dispatchEventToRegions({ sessionId: s.sessionId, eventId: "EVT-001", dispatchedByUserId: s.ownerUserId, actionUserId: s.ownerUserId });
      expect(r.ok).toBe(true);
    }
    const now = new Date();
    const deadlinesOf = async (sid: string) =>
      (await db.query.eventDispatches.findMany({ where: eq(eventDispatches.sessionId, sid) })).map((d) => d.deadlineAt!.getTime());
    const aBefore = await deadlinesOf(a.sessionId);
    const bBefore = await deadlinesOf(b.sessionId);

    expect(await rescaleOpenDeadlines(a.sessionId, 2, now)).toBe(6);
    const aAfter = await deadlinesOf(a.sessionId);
    aAfter.forEach((t, i) => expect(t - now.getTime()).toBeCloseTo((aBefore[i] - now.getTime()) * 2, -2));
    expect(await deadlinesOf(b.sessionId)).toEqual(bBefore);

    await extendOpenDeadlines(a.sessionId, 2, now);
    const aExtended = await deadlinesOf(a.sessionId);
    aExtended.forEach((t, i) => expect(t - aAfter[i]).toBe(2 * MIN));
    expect(await deadlinesOf(b.sessionId)).toEqual(bBefore);
  });

  it("autopilot fires the due required event once, only when enabled, only in its own session", async () => {
    const a = await createTestSession("instructor");
    const b = await createTestSession("instructor");
    const startedAt = new Date(Date.now() - 2 * MIN);
    for (const s of [a, b]) {
      await db
        .update(sessionState)
        .set({ simulationStatus: "running", simulationStartedAt: startedAt })
        .where(eq(sessionState.sessionId, s.sessionId));
    }

    expect(await runAutopilot(a.sessionId)).toBeNull(); // off by default

    await db.update(sessionState).set({ autopilotEnabled: true }).where(eq(sessionState.sessionId, a.sessionId));
    expect(await runAutopilot(a.sessionId)).toBe("EVT-001");
    expect(await runAutopilot(a.sessionId)).toBeNull(); // never fires the same event twice

    const aDispatches = await db.query.eventDispatches.findMany({ where: eq(eventDispatches.sessionId, a.sessionId) });
    const aTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, a.sessionId) });
    expect(aDispatches).toHaveLength(aTeams.length);
    expect(await db.query.eventDispatches.findMany({ where: eq(eventDispatches.sessionId, b.sessionId) })).toHaveLength(0);

    // The new class-session window: EVT-001 (2 stated hours) gets 7 minutes.
    const d = aDispatches[0];
    expect((d.deadlineAt!.getTime() - d.dispatchedAt.getTime()) / MIN).toBeCloseTo(7, 1);
  });

  it("autopilot does nothing in demo sessions", async () => {
    const demo = await createTestSession("demo");
    await db
      .update(sessionState)
      .set({ simulationStatus: "running", simulationStartedAt: new Date(Date.now() - 2 * MIN), autopilotEnabled: true })
      .where(eq(sessionState.sessionId, demo.sessionId));
    expect(await runAutopilot(demo.sessionId)).toBeNull();
  });
});
