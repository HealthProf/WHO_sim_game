// Display metadata for the history metrics (client-safe).
import type { HistoryMetric } from "./history";

export interface MetricMeta {
  label: string;
  short: string;
  format: (v: number) => string;
  yDomain?: [number, number];
  reference?: { y: number; label: string };
}

const compact = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 10_000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));

export const METRIC_META: Record<HistoryMetric, MetricMeta> = {
  rt: { label: "Rt (spread)", short: "Rt", format: (v) => v.toFixed(2), reference: { y: 1, label: "Rt = 1 (below: shrinking)" } },
  publicTrustIndex: { label: "Public trust (0-100)", short: "Trust", format: (v) => String(Math.round(v)), yDomain: [0, 100], reference: { y: 45, label: "45 = warning" } },
  populationHappinessIndex: { label: "Morale (0-100)", short: "Morale", format: (v) => String(Math.round(v)), yDomain: [0, 100], reference: { y: 45, label: "45 = warning" } },
  deaths: { label: "Deaths (cumulative)", short: "Deaths", format: compact },
  confirmedCases: { label: "Confirmed cases (cumulative)", short: "Cases", format: compact },
};

export const CYCLE_ORDER: HistoryMetric[] = ["rt", "confirmedCases", "deaths", "publicTrustIndex", "populationHappinessIndex"];
