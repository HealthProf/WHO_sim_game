// Time series for the Release 4 line charts and projector spotlight, built
// from model_state_history (every change to a region's model appends a
// snapshot). Sampled onto a fixed grid of play-time minutes, carrying each
// region's last known value forward, so every chart gets the same x-axis.
//
// Scoped to one session (sessionId in the only query). The x-axis is real
// minutes since the simulation started; pauses are not subtracted, which is
// fine for a picture of "how things have moved" and keeps the math simple.
import { db } from "./db";
import { modelStateHistory, sessionState } from "./db/schema";
import { asc, eq } from "drizzle-orm";
import { regionSeed } from "./db/seed-data/regions";
import { REGIONS, type RegionId } from "./regions";

export const HISTORY_METRICS = ["rt", "publicTrustIndex", "populationHappinessIndex", "deaths", "confirmedCases"] as const;
export type HistoryMetric = (typeof HISTORY_METRICS)[number];

export interface HistoryPoint {
  m: number; // minutes since the simulation started
  // Partial: shared views omit other regions' private metrics (see below).
  v: Partial<Record<HistoryMetric, number>>;
}

// Trust and morale are a region's private standing: shared screens show only
// the world average (see app/api/dashboard's note on global averages). Rt,
// cases and deaths are already public on the projector.
export const PRIVATE_METRICS: HistoryMetric[] = ["publicTrustIndex", "populationHappinessIndex"];

export interface RegionChange {
  regionId: RegionId;
  metric: HistoryMetric;
  from: number;
  to: number;
  // Signed change in "goodness": positive = better for the region.
  direction: "better" | "worse";
  magnitude: number; // 0..1+, how big relative to the metric's threshold
}

export interface SessionHistory {
  minutes: number; // span covered
  series: Record<RegionId, HistoryPoint[]>;
  // World average (Rt, trust, morale) and totals (deaths, cases) per sample.
  world: HistoryPoint[];
  // Biggest moves over the last RECENT_WINDOW_MINUTES, largest first.
  recentChanges: RegionChange[];
}

const SAMPLES = 40;
export const RECENT_WINDOW_MINUTES = 5;
// What counts as a notable move in the recent window, per metric. Mirrors
// the scale of lib/model-engine/core.ts's "significant delta" thresholds.
const NOTABLE: Record<HistoryMetric, number> = {
  rt: 0.2,
  publicTrustIndex: 10,
  populationHappinessIndex: 10,
  deaths: Number.POSITIVE_INFINITY, // judged relatively, below
  confirmedCases: Number.POSITIVE_INFINITY,
};
const HIGHER_IS_BETTER: Record<HistoryMetric, boolean> = {
  rt: false,
  publicTrustIndex: true,
  populationHappinessIndex: true,
  deaths: false,
  confirmedCases: false,
};

function startingValues(regionId: string): Record<HistoryMetric, number> {
  const r = regionSeed.find((x) => x.id === regionId)!;
  return {
    rt: r.startingRt,
    publicTrustIndex: r.startingPublicTrust,
    populationHappinessIndex: 60, // the model's fixed starting morale (lib/session-lifecycle.ts)
    deaths: r.startingDeaths,
    confirmedCases: r.startingConfirmed,
  };
}

export async function buildSessionHistory(sessionId: string, now: Date = new Date()): Promise<SessionHistory> {
  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  const empty = Object.fromEntries(REGIONS.map((r) => [r, [{ m: 0, v: startingValues(r) }]])) as Record<RegionId, HistoryPoint[]>;
  if (!gs?.simulationStartedAt) return { minutes: 0, series: empty, world: worldOf(empty), recentChanges: [] };

  const start = gs.simulationStartedAt.getTime();
  const rows = await db.query.modelStateHistory.findMany({
    where: eq(modelStateHistory.sessionId, sessionId),
    orderBy: asc(modelStateHistory.createdAt),
  });
  // While running, extend to the newest snapshot even if the database clock
  // is a few ms ahead of this server's, so a change written "just now" is
  // never dropped (the projector only refetches when stateVersion changes).
  const latestRow = rows.length ? rows[rows.length - 1].createdAt.getTime() : 0;
  const end = gs.simulationStatus === "running" || !gs.pausedAt ? Math.max(now.getTime(), latestRow) : gs.pausedAt.getTime();
  const minutes = Math.max(0, (end - start) / 60000);

  const grid = Array.from({ length: SAMPLES + 1 }, (_, i) => (minutes * i) / SAMPLES);
  const series = {} as Record<RegionId, HistoryPoint[]>;
  for (const regionId of REGIONS) {
    const own = rows.filter((r) => r.regionId === regionId);
    let idx = 0;
    let current = startingValues(regionId);
    series[regionId] = grid.map((m) => {
      const t = start + m * 60000;
      while (idx < own.length && own[idx].createdAt.getTime() <= t) {
        const snap = own[idx].snapshotJson as Partial<Record<HistoryMetric, number>>;
        current = { ...current, ...Object.fromEntries(HISTORY_METRICS.filter((k) => typeof snap[k] === "number").map((k) => [k, snap[k] as number])) };
        idx++;
      }
      return { m: Math.round(m * 10) / 10, v: { ...current } };
    });
  }

  return { minutes, series, world: worldOf(series), recentChanges: recentChangesFrom(series, minutes) };
}

function worldOf(series: Record<RegionId, HistoryPoint[]>): HistoryPoint[] {
  const n = series[REGIONS[0]].length;
  return Array.from({ length: n }, (_, i) => {
    const vals = REGIONS.map((r) => series[r][i].v);
    const mean = (k: HistoryMetric) => vals.reduce((a, v) => a + (v[k] ?? 0), 0) / vals.length;
    const sum = (k: HistoryMetric) => vals.reduce((a, v) => a + (v[k] ?? 0), 0);
    return {
      m: series[REGIONS[0]][i].m,
      v: {
        rt: Math.round(mean("rt") * 100) / 100,
        publicTrustIndex: Math.round(mean("publicTrustIndex")),
        populationHappinessIndex: Math.round(mean("populationHappinessIndex")),
        deaths: sum("deaths"),
        confirmedCases: sum("confirmedCases"),
      },
    };
  });
}

function stripPrivate(points: HistoryPoint[]): HistoryPoint[] {
  return points.map((p) => {
    const v = { ...p.v };
    for (const k of PRIVATE_METRICS) delete v[k];
    return { m: p.m, v };
  });
}

// What a team may see: its own region in full; other regions' public
// metrics only; world averages.
export function historyForTeam(h: SessionHistory, ownRegionId: string): SessionHistory {
  const series = Object.fromEntries(REGIONS.map((r) => [r, r === ownRegionId ? h.series[r] : stripPrivate(h.series[r])])) as Record<RegionId, HistoryPoint[]>;
  return {
    ...h,
    series,
    recentChanges: h.recentChanges.filter((c) => c.regionId === ownRegionId || !PRIVATE_METRICS.includes(c.metric)),
  };
}

// What the public projector may see: no region's private metrics.
export function historyForPublic(h: SessionHistory): SessionHistory {
  const series = Object.fromEntries(REGIONS.map((r) => [r, stripPrivate(h.series[r])])) as Record<RegionId, HistoryPoint[]>;
  return { ...h, series, recentChanges: h.recentChanges.filter((c) => !PRIVATE_METRICS.includes(c.metric)) };
}

export function valueAt(points: HistoryPoint[], m: number): Partial<Record<HistoryMetric, number>> {
  let last = points[0].v;
  for (const p of points) {
    if (p.m <= m) last = p.v;
    else break;
  }
  return last;
}

export function recentChangesFrom(series: Record<RegionId, HistoryPoint[]>, minutes: number): RegionChange[] {
  if (minutes <= 0) return [];
  const since = Math.max(0, minutes - RECENT_WINDOW_MINUTES);
  const changes: RegionChange[] = [];
  // Cases and deaths grow exponentially by design, so "up 50% in five
  // minutes" is normal. They're judged against the world's own growth over
  // the same window: notable only when a region grows 1.5x faster (or
  // slower) than the world as a whole.
  const worldGrowth: Partial<Record<HistoryMetric, number>> = {};
  for (const metric of ["deaths", "confirmedCases"] as const) {
    const b = REGIONS.reduce((sum, r) => sum + (valueAt(series[r], since)[metric] ?? 0), 0);
    const a = REGIONS.reduce((sum, r) => sum + (series[r][series[r].length - 1].v[metric] ?? 0), 0);
    worldGrowth[metric] = b > 0 ? a / b : 1;
  }
  for (const regionId of REGIONS) {
    const pts = series[regionId];
    const before = valueAt(pts, since);
    const after = pts[pts.length - 1].v;
    for (const metric of HISTORY_METRICS) {
      const a = after[metric];
      const b = before[metric];
      if (a == null || b == null) continue;
      const d = a - b;
      if (d === 0) continue;
      let magnitude: number;
      let better: boolean;
      if (metric === "deaths" || metric === "confirmedCases") {
        if (b < 10) continue;
        const relative = a / b / (worldGrowth[metric] ?? 1);
        if (relative >= 1) {
          magnitude = (relative - 1) / 0.5;
          better = false;
        } else {
          magnitude = (1 / relative - 1) / 0.5;
          better = true;
        }
      } else {
        magnitude = Math.abs(d) / NOTABLE[metric];
        better = d > 0 === HIGHER_IS_BETTER[metric];
      }
      if (magnitude < 1) continue;
      changes.push({ regionId, metric, from: b, to: a, direction: better ? "better" : "worse", magnitude });
    }
  }
  return changes.sort((a, b) => b.magnitude - a.magnitude);
}
