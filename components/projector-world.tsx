"use client";

import { useEffect, useRef, useState } from "react";
import { WorldMap } from "@/components/world-map";
import { WorldTrendsChart } from "@/components/world-trends";
import { RegionAvatar } from "@/components/region-avatar";
import { METRIC_META, CYCLE_ORDER } from "@/lib/history-metrics";
import { moodFor } from "@/lib/avatar-mood";
import { REGIONS } from "@/lib/regions";
import type { HistoryMetric, RegionChange, SessionHistory } from "@/lib/history";

// The projector's world view (Release 4) and its "director":
// - The map cycles through the public metrics (Rt, cases, deaths) and the
//   trend chart through all five (trust and morale as world averages only,
//   since a region's own trust/morale is private), every CYCLE_MS.
// - When a region has changed sharply in the last few minutes
//   (history.recentChanges), the map zooms to it for SPOTLIGHT_MS with a
//   banner saying what moved, and the trend chart switches to that metric.
// - A big worsening or improvement also triggers a frame alert: a slow
//   colored glow around the whole screen (onAlert), never a flash. Each
//   change is spotlighted once.
const CYCLE_MS = 12_000;
const SPOTLIGHT_MS = 10_000;
const MAP_CYCLE: HistoryMetric[] = ["rt", "confirmedCases", "deaths"];
const ALERT_MAGNITUDE = 1.5;

export interface ProjectorAlert {
  tone: "bad" | "good";
  text: string;
  key: string;
}

export function ProjectorWorld({ history, onAlert }: { history: SessionHistory; onAlert?: (a: ProjectorAlert) => void }) {
  const [tick, setTick] = useState(0);
  const [spotlight, setSpotlight] = useState<{ change: RegionChange; until: number } | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  // Pick up new notable changes. On the very first load we mark existing
  // ones as seen, so opening the projector mid-game doesn't replay old news.
  useEffect(() => {
    const keyOf = (c: RegionChange) => `${c.regionId}:${c.metric}:${c.direction}:${Math.round(c.to * 100)}`;
    if (firstLoad.current) {
      history.recentChanges.forEach((c) => seen.current.add(keyOf(c)));
      firstLoad.current = false;
      return;
    }
    const fresh = history.recentChanges.find((c) => !seen.current.has(keyOf(c)));
    if (!fresh) return;
    seen.current.add(keyOf(fresh));
    const until = Date.now() + SPOTLIGHT_MS;
    // Defer the state update out of the effect body (react-hooks rule).
    const t = setTimeout(() => {
      setSpotlight({ change: fresh, until });
      if (fresh.magnitude >= ALERT_MAGNITUDE) {
        onAlert?.({ tone: fresh.direction === "worse" ? "bad" : "good", text: describe(fresh), key: keyOf(fresh) });
      }
    }, 0);
    return () => clearTimeout(t);
  }, [history.recentChanges, onAlert]);

  useEffect(() => {
    if (!spotlight) return;
    const t = setTimeout(() => setSpotlight(null), Math.max(0, spotlight.until - Date.now()));
    return () => clearTimeout(t);
  }, [spotlight]);

  const mapMetric: HistoryMetric = spotlight && MAP_CYCLE.includes(spotlight.change.metric) ? spotlight.change.metric : MAP_CYCLE[tick % MAP_CYCLE.length];
  const trendMetric: HistoryMetric = spotlight ? spotlight.change.metric : CYCLE_ORDER[tick % CYCLE_ORDER.length];

  const latest = (r: string) => history.series[r as keyof typeof history.series].at(-1)!.v;
  const values = Object.fromEntries(REGIONS.map((r) => [r, METRIC_META[mapMetric].format(latest(r)[mapMetric] ?? 0)]));
  const badges = Object.fromEntries(
    REGIONS.map((r) => [r, <RegionAvatar key={r} regionId={r} mood={moodFor({ rt: latest(r).rt ?? 1 }, history.recentChanges, r)} size={30} theme="dark" asGroup />])
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="relative rounded-lg bg-neutral-800 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-neutral-400">World map: {METRIC_META[mapMetric].label}</p>
          <p className="text-xs text-neutral-500" aria-hidden="true">
            {MAP_CYCLE.map((m) => (
              <span key={m} className={m === mapMetric ? "font-bold text-neutral-200" : ""}>
                {" "}
                {METRIC_META[m].short}
              </span>
            ))}
          </p>
        </div>
        <WorldMap values={values} metricLabel={METRIC_META[mapMetric].label} theme="dark" focusRegion={spotlight?.change.regionId} badges={badges} />
        {spotlight && (
          <div
            role="status"
            className={`absolute inset-x-4 bottom-10 rounded-md px-4 py-3 text-lg font-semibold text-white shadow-lg ${
              spotlight.change.direction === "worse" ? "bg-accent-800" : "bg-accent-2-700"
            }`}
          >
            {spotlight.change.direction === "worse" ? "▼ " : "▲ "}
            {describe(spotlight.change)}
          </div>
        )}
      </div>
      <div className="rounded-lg bg-neutral-800 p-4">
        <WorldTrendsChart history={history} metric={trendMetric} theme="dark" highlightRegion={spotlight?.change.regionId} compact />
      </div>
    </div>
  );
}

function describe(c: RegionChange): string {
  const meta = METRIC_META[c.metric];
  return `${c.regionId}: ${meta.short} ${c.direction === "worse" ? "worsened" : "improved"} from ${meta.format(c.from)} to ${meta.format(c.to)} in the last few minutes`;
}
