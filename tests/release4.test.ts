import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { modelState, modelStateHistory, sessionState } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { resetDb, seedStaticOnce } from "./helpers/db";
import { createTestSession } from "./helpers/session";
import { buildSessionHistory, historyForPublic, historyForTeam, recentChangesFrom, type HistoryPoint } from "@/lib/history";
import { moodFor } from "@/lib/avatar-mood";
import { NUMERIC_TO_REGION, regionForFeature } from "@/lib/who-region-geo";
import { buildWorldGeometry } from "@/lib/world-geo";
import { REGIONS, type RegionId } from "@/lib/regions";
import { REGION_COLORS_DARK, REGION_COLORS_LIGHT } from "@/lib/region-colors";

const MIN = 60_000;

describe("map data", () => {
  it("assigns well-known member states to the right WHO region", () => {
    expect(regionForFeature("840", "United States of America")).toBe("AMRO");
    expect(regionForFeature("566", "Nigeria")).toBe("AFRO");
    expect(regionForFeature("818", "Egypt")).toBe("EMRO");
    expect(regionForFeature("643", "Russia")).toBe("EURO");
    expect(regionForFeature("356", "India")).toBe("SEARO");
    expect(regionForFeature("156", "China")).toBe("WPRO");
    expect(regionForFeature(undefined, "Somaliland")).toBe("EMRO");
    expect(regionForFeature("158", "Taiwan")).toBeNull(); // deliberately unassigned
    expect(new Set(Object.values(NUMERIC_TO_REGION))).toEqual(new Set(REGIONS));
  });

  it("builds a shape, label point, and sane zoom box for every region", () => {
    const g = buildWorldGeometry(960, 470);
    for (const r of g.regions) {
      expect(r.path.length).toBeGreaterThan(100);
      const [[x0, y0], [x1, y1]] = r.bounds;
      expect(x1 - x0).toBeGreaterThan(20);
      expect(x1 - x0).toBeLessThan(900); // date-line slivers excluded
      expect(r.labelAt[0]).toBeGreaterThanOrEqual(x0 - 1);
      expect(r.labelAt[1]).toBeGreaterThanOrEqual(y0 - 1);
      expect(y1).toBeLessThanOrEqual(470);
    }
  });

  it("every region has a light and dark identity color", () => {
    for (const r of REGIONS) {
      expect(REGION_COLORS_LIGHT[r]).toMatch(/^#[0-9a-f]{6}$/);
      expect(REGION_COLORS_DARK[r]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("avatar moods", () => {
  it("follows the simulation's thresholds, and shock wins", () => {
    expect(moodFor({ rt: 0.9, publicTrustIndex: 85, populationHappinessIndex: 70 })).toBe("thriving");
    expect(moodFor({ rt: 1.2, publicTrustIndex: 60, populationHappinessIndex: 60 })).toBe("calm");
    expect(moodFor({ rt: 1.2, publicTrustIndex: 40, populationHappinessIndex: 60 })).toBe("worried");
    expect(moodFor({ rt: 2.1, publicTrustIndex: 60, populationHappinessIndex: 60 })).toBe("distressed");
    const shock = [{ regionId: "AFRO" as RegionId, metric: "rt" as const, from: 1, to: 1.5, direction: "worse" as const, magnitude: 2.5 }];
    expect(moodFor({ rt: 1, publicTrustIndex: 85, populationHappinessIndex: 70 }, shock, "AFRO")).toBe("shocked");
    expect(moodFor({ rt: 0.9, publicTrustIndex: 85, populationHappinessIndex: 70 }, shock, "AMRO")).toBe("thriving");
  });

  it("on shared screens uses public data only (no trust/morale)", () => {
    expect(moodFor({ rt: 0.9 })).toBe("thriving");
    expect(moodFor({ rt: 1.7 })).toBe("worried");
  });
});

describe("recent change detection", () => {
  const pts = (vals: number[]): HistoryPoint[] =>
    vals.map((rt, i) => ({ m: i, v: { rt, publicTrustIndex: 60, populationHappinessIndex: 60, deaths: 100, confirmedCases: 1000 } }));
  it("flags big moves in the last few minutes, largest first, with direction", () => {
    const series = Object.fromEntries(REGIONS.map((r) => [r, pts([1, 1, 1, 1, 1, 1, 1, 1, 1, 1])])) as Record<RegionId, HistoryPoint[]>;
    series.AFRO = pts([1, 1, 1, 1, 1, 1, 1.1, 1.3, 1.5, 1.6]);
    series.EURO = pts([1, 1, 1, 1, 1, 1, 1, 0.9, 0.8, 0.7]);
    const c = recentChangesFrom(series, 9);
    expect(c[0]).toMatchObject({ regionId: "AFRO", metric: "rt", direction: "worse" });
    expect(c[1]).toMatchObject({ regionId: "EURO", direction: "better" });
    expect(c.find((x) => x.regionId === "AMRO")).toBeUndefined();
  });
});

describe("cases/deaths judged against world growth", () => {
  it("doesn't flag normal shared exponential growth, but flags a region racing ahead", () => {
    const grow = (from: number, to: number): HistoryPoint[] =>
      Array.from({ length: 10 }, (_, i) => ({ m: i, v: { rt: 1.2, publicTrustIndex: 60, populationHappinessIndex: 60, deaths: 50, confirmedCases: Math.round(from * (to / from) ** (i / 9)) } }));
    const series = Object.fromEntries(REGIONS.map((r) => [r, grow(1000, 3000)])) as Record<RegionId, HistoryPoint[]>;
    expect(recentChangesFrom(series, 9).filter((c) => c.metric === "confirmedCases")).toEqual([]);
    series.SEARO = grow(1000, 12000);
    const flagged = recentChangesFrom(series, 9).filter((c) => c.metric === "confirmedCases");
    expect(flagged[0]).toMatchObject({ regionId: "SEARO", direction: "worse" });
  });
});

describe("session history (DB)", () => {
  beforeEach(async () => {
    await resetDb();
    await seedStaticOnce();
  });

  it("is per session, and teams/projector never see other regions' trust or morale", async () => {
    const a = await createTestSession("instructor");
    const b = await createTestSession("instructor");
    for (const s of [a, b]) {
      await db
        .update(sessionState)
        .set({ simulationStatus: "running", simulationStartedAt: new Date(Date.now() - 20 * MIN) })
        .where(eq(sessionState.sessionId, s.sessionId));
    }
    const afro = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, a.sessionId), eq(modelState.regionId, "AFRO")) });
    await db.insert(modelStateHistory).values({
      sessionId: a.sessionId,
      regionId: "AFRO",
      day: 1,
      snapshotJson: { ...afro, rt: 2.5, publicTrustIndex: 20 },
      reason: "test",
      createdAt: new Date(Date.now() - 2 * MIN),
    });

    const ha = await buildSessionHistory(a.sessionId);
    const hb = await buildSessionHistory(b.sessionId);
    expect(ha.series.AFRO.at(-1)!.v.rt).toBe(2.5);
    expect(hb.series.AFRO.at(-1)!.v.rt).not.toBe(2.5);
    expect(ha.recentChanges.some((c) => c.regionId === "AFRO" && c.metric === "rt")).toBe(true);

    const amroView = historyForTeam(ha, "AMRO");
    expect(amroView.series.AFRO.at(-1)!.v.publicTrustIndex).toBeUndefined();
    expect(amroView.series.AFRO.at(-1)!.v.rt).toBe(2.5);
    expect(amroView.series.AMRO.at(-1)!.v.publicTrustIndex).toBeDefined();
    expect(amroView.recentChanges.some((c) => c.regionId === "AFRO" && c.metric === "publicTrustIndex")).toBe(false);

    const afroView = historyForTeam(ha, "AFRO");
    expect(afroView.series.AFRO.at(-1)!.v.publicTrustIndex).toBe(20);

    const pub = historyForPublic(ha);
    for (const r of REGIONS) expect(pub.series[r].at(-1)!.v.publicTrustIndex).toBeUndefined();
    expect(pub.world.at(-1)!.v.publicTrustIndex).toBeDefined(); // world average stays
  });
});
