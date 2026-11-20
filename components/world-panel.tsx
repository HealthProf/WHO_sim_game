"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { WorldMap } from "@/components/world-map";
import { WorldTrendsChart } from "@/components/world-trends";
import { RegionAvatar } from "@/components/region-avatar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { METRIC_META } from "@/lib/history-metrics";
import { moodFor } from "@/lib/avatar-mood";
import { REGIONS } from "@/lib/regions";
import type { HistoryMetric, SessionHistory } from "@/lib/history";

const MAP_METRICS: HistoryMetric[] = ["rt", "confirmedCases", "deaths"];
const TREND_METRICS: HistoryMetric[] = ["rt", "confirmedCases", "deaths", "publicTrustIndex", "populationHappinessIndex"];

// The team's "global view" (Release 4): a map of the six regions with their
// avatars, and how each metric has changed over time. Other regions' trust
// and morale are private (lib/history.ts), so those trend charts show the
// team's own line against the world average.
export function WorldPanel({ ownRegionId }: { ownRegionId?: string | null }) {
  const [mapMetric, setMapMetric] = useState<HistoryMetric>("rt");
  const [trendMetric, setTrendMetric] = useState<HistoryMetric>("rt");
  const { data } = useQuery({
    queryKey: ["history"],
    queryFn: () => apiFetch<SessionHistory>("/api/history"),
    refetchInterval: 20000,
  });
  if (!data) return <p className="text-sm text-neutral-700">Loading the world picture…</p>;

  const latest = (r: string) => data.series[r as keyof typeof data.series].at(-1)!.v;
  const values = Object.fromEntries(REGIONS.map((r) => [r, METRIC_META[mapMetric].format(latest(r)[mapMetric] ?? 0)]));
  const badges = Object.fromEntries(
    REGIONS.map((r) => {
      const v = latest(r);
      const mood = moodFor({ rt: v.rt ?? 1, publicTrustIndex: v.publicTrustIndex, populationHappinessIndex: v.populationHappinessIndex }, data.recentChanges, r);
      return [r, <RegionAvatar key={r} regionId={r} mood={mood} size={28} asGroup />];
    })
  );

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-lg bg-surface p-4" data-tour="world-map">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-text">World map</h2>
          <SegmentedControl
            options={MAP_METRICS.map((m) => ({ value: m, label: METRIC_META[m].short }))}
            value={mapMetric}
            onChange={setMapMetric}
          />
        </div>
        <WorldMap values={values} metricLabel={METRIC_META[mapMetric].label} ownRegion={ownRegionId} badges={badges} />
        {data.recentChanges.length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-neutral-800">
            {data.recentChanges.slice(0, 3).map((c) => (
              <li key={`${c.regionId}-${c.metric}`}>
                <span className="font-semibold">{c.regionId}</span> {METRIC_META[c.metric].short} {c.direction === "worse" ? "worsened" : "improved"}{" "}
                from {METRIC_META[c.metric].format(c.from)} to {METRIC_META[c.metric].format(c.to)} in the last few minutes.
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg bg-surface p-4" data-tour="world-trends">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-text">How things are changing</h2>
          <SegmentedControl
            options={TREND_METRICS.map((m) => ({ value: m, label: METRIC_META[m].short }))}
            value={trendMetric}
            onChange={setTrendMetric}
          />
        </div>
        <WorldTrendsChart history={data} metric={trendMetric} highlightRegion={ownRegionId} />
      </section>
    </div>
  );
}
