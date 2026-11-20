"use client";

import { LineChart, type LineSeries } from "@/components/line-chart";
import { METRIC_META } from "@/lib/history-metrics";
import { regionColor } from "@/lib/region-colors";
import { REGIONS } from "@/lib/regions";
import type { HistoryMetric, SessionHistory } from "@/lib/history";

// One metric for all six regions over time (Release 4), so the room can see
// how things are *changing*, not just where they stand.
export function WorldTrendsChart({
  history,
  metric,
  theme = "light",
  highlightRegion,
  compact,
}: {
  history: SessionHistory;
  metric: HistoryMetric;
  theme?: "light" | "dark";
  highlightRegion?: string | null;
  compact?: boolean;
}) {
  const meta = METRIC_META[metric];
  // Regions whose value for this metric is visible to this viewer (trust and
  // morale are private: a team sees only its own; the projector, none).
  const visible = REGIONS.filter((r) => history.series[r].every((p) => p.v[metric] != null));
  const series: LineSeries[] = visible.map((r) => ({
    id: r,
    label: r,
    color: regionColor(r, theme),
    points: history.series[r].map((p) => ({ x: p.m, y: p.v[metric] as number })),
  }));
  if (visible.length < REGIONS.length) {
    series.push({
      id: "WORLD",
      label: "World avg",
      color: theme === "dark" ? "#c0b6a5" : "#645c50",
      points: history.world.map((p) => ({ x: p.m, y: p.v[metric] as number })),
    });
  }
  return (
    <LineChart
      title={`${meta.label} over time`}
      series={series}
      theme={theme}
      yFormat={meta.format}
      yDomain={meta.yDomain}
      reference={meta.reference}
      highlightId={highlightRegion ?? undefined}
      compact={compact}
    />
  );
}
