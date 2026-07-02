"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { SummaryReportViewer } from "@/components/summary-report-viewer";
import { QueryError } from "@/components/query-error";
import { regionColors } from "@/lib/who-region-map";
import type { SummaryRound } from "@/lib/summary-report";

interface TeamHighlightEntry {
  eventId: string;
  eventTitle: string;
  tier: string;
  compositePct: number;
}

interface RegionFinalResult {
  regionId: string;
  actualConfirmed: number;
  actualDeaths: number;
  optimalConfirmed: number;
  optimalDeaths: number;
  infectionsPrevented: number;
  deathsPrevented: number;
}

interface FinalResults {
  regions: RegionFinalResult[];
  totalActualConfirmed: number;
  totalActualDeaths: number;
  totalOptimalConfirmed: number;
  totalOptimalDeaths: number;
  totalInfectionsPrevented: number;
  totalDeathsPrevented: number;
}

interface DebriefData {
  modelStateHistory: { id: number; regionId: string; day: number; reason: string; createdAt: string; snapshotJson: { rt: number; cfrMultiplier: number } }[];
  evt006Allocations: { regionId: string; allocation: Record<string, number> | null }[];
  evt012Allocations: { regionId: string; allocation: Record<string, number> | null }[];
  mostConsequentialScores: { score: { tier: string; compositePct: number }; decision: { id: number; rationaleText: string } | undefined }[];
  teamHighlights: { regionId: string; strongest: TeamHighlightEntry[]; weakest: TeamHighlightEntry[] }[];
  pledgeTotals: Record<string, { given: number; received: number }>;
  finalResults: FinalResults;
}

export default function DebriefPage() {
  const { data, error, refetch } = useQuery({ queryKey: ["debrief"], queryFn: () => apiFetch<DebriefData>("/api/instructor/debrief") });
  const { data: summary } = useQuery({ queryKey: ["summary-report"], queryFn: () => apiFetch<{ rounds: SummaryRound[] }>("/api/summary-report") });

  if (error) return <QueryError error={error} onRetry={() => refetch()} label="debrief data" />;
  if (!data) return <p className="text-slate-400">Loading debrief data...</p>;

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold">After-Action Debrief</h2>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <div>
          <h3 className="text-xl font-semibold">Final Results: Actual vs. Ideal Playthrough</h3>
          <p className="text-sm text-slate-400 mt-1">
            &quot;Actual&quot; is what really happened in this session. &quot;Ideal&quot; is a parallel shadow simulation that
            received only the OPTIMAL-tier consequence at every decision point — a realistic ceiling on how much
            better this outcome could have been, not a theoretical zero.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <FinalStat label="Actual Confirmed" value={data.finalResults.totalActualConfirmed.toLocaleString()} />
          <FinalStat label="Actual Deaths" value={data.finalResults.totalActualDeaths.toLocaleString()} />
          <FinalStat label="Ideal Confirmed" value={data.finalResults.totalOptimalConfirmed.toLocaleString()} tone="emerald" />
          <FinalStat label="Ideal Deaths" value={data.finalResults.totalOptimalDeaths.toLocaleString()} tone="emerald" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-amber-950/40 border border-amber-800 rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-amber-300">Infections That Could Have Been Prevented</p>
            <p className="text-3xl font-bold mt-1">{data.finalResults.totalInfectionsPrevented.toLocaleString()}</p>
          </div>
          <div className="bg-red-950/40 border border-red-800 rounded-lg p-4">
            <p className="text-xs uppercase tracking-wide text-red-300">Deaths That Could Have Been Prevented</p>
            <p className="text-3xl font-bold mt-1">{data.finalResults.totalDeathsPrevented.toLocaleString()}</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-300 mb-2">Per-Region Breakdown</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-800">
                  <th className="py-2 pr-4">Region</th>
                  <th className="py-2 pr-4">Actual Confirmed</th>
                  <th className="py-2 pr-4">Ideal Confirmed</th>
                  <th className="py-2 pr-4">Infections Prevented</th>
                  <th className="py-2 pr-4">Actual Deaths</th>
                  <th className="py-2 pr-4">Ideal Deaths</th>
                  <th className="py-2 pr-4">Deaths Prevented</th>
                </tr>
              </thead>
              <tbody>
                {data.finalResults.regions.map((r) => (
                  <tr key={r.regionId} className="border-b border-slate-900">
                    <td className="py-2 pr-4 font-medium">
                      <span className="inline-block w-2.5 h-2.5 rounded-full mr-2" style={{ background: regionColors[r.regionId] }} />
                      {r.regionId}
                    </td>
                    <td className="py-2 pr-4">{r.actualConfirmed.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-emerald-400">{r.optimalConfirmed.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-amber-400 font-semibold">{r.infectionsPrevented.toLocaleString()}</td>
                    <td className="py-2 pr-4">{r.actualDeaths.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-emerald-400">{r.optimalDeaths.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-red-400 font-semibold">{r.deathsPrevented.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <h3 className="font-medium mb-3">Round-by-Round Summary</h3>
        {summary ? <SummaryReportViewer rounds={summary.rounds} /> : <p className="text-slate-400">Loading...</p>}
      </section>

      <section>
        <h3 className="font-medium mb-2">Model State Trajectory (full history)</h3>
        <div className="max-h-64 overflow-y-auto text-xs space-y-1">
          {data.modelStateHistory.map((h) => (
            <p key={h.id} className="text-slate-400">
              Day {h.day} - {h.regionId}: Rt {h.snapshotJson.rt?.toFixed(2)}, CFR x{h.snapshotJson.cfrMultiplier?.toFixed(2)} — {h.reason}
            </p>
          ))}
          {data.modelStateHistory.length === 0 && <p className="text-slate-500">No scored decisions yet.</p>}
        </div>
      </section>

      <section>
        <h3 className="font-medium mb-2">EVT-006 vs EVT-012 Allocation Comparison</h3>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-slate-400 mb-1">EVT-006 (first tranche)</p>
            {data.evt006Allocations.map((a) => (
              <p key={a.regionId} className="text-xs text-slate-300">{a.regionId}: {a.allocation ? JSON.stringify(a.allocation) : "no submission"}</p>
            ))}
          </div>
          <div>
            <p className="text-slate-400 mb-1">EVT-012 (second tranche)</p>
            {data.evt012Allocations.map((a) => (
              <p key={a.regionId} className="text-xs text-slate-300">{a.regionId}: {a.allocation ? JSON.stringify(a.allocation) : "no submission"}</p>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h3 className="font-medium mb-2">Most Consequential Decisions</h3>
        {data.mostConsequentialScores.map((s, i) => (
          <div key={i} className="text-xs text-slate-400 mb-2">
            <span className={s.score.tier === "OPTIMAL" ? "text-emerald-400" : "text-red-400"}>{s.score.tier}</span> ({s.score.compositePct.toFixed(0)}%) —{" "}
            {s.decision?.rationaleText.slice(0, 140)}...
          </div>
        ))}
      </section>

      <section>
        <h3 className="font-medium mb-3">Per-Team Highlights (3 strongest / 3 weakest)</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.teamHighlights.map((h) => (
            <div key={h.regionId} className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-xs space-y-2">
              <p className="font-semibold text-sm">{h.regionId}</p>
              <div>
                <p className="text-emerald-400 font-medium mb-1">Strongest</p>
                {h.strongest.length === 0 && <p className="text-slate-600">No scored decisions yet.</p>}
                {h.strongest.map((e, i) => (
                  <p key={i} className="text-slate-300">{e.eventId} — {e.eventTitle} ({e.tier.replace("_", " ")}, {e.compositePct.toFixed(0)}%)</p>
                ))}
              </div>
              <div>
                <p className="text-red-400 font-medium mb-1">Weakest</p>
                {h.weakest.length === 0 && <p className="text-slate-600">Not enough distinct decisions.</p>}
                {h.weakest.map((e, i) => (
                  <p key={i} className="text-slate-300">{e.eventId} — {e.eventTitle} ({e.tier.replace("_", " ")}, {e.compositePct.toFixed(0)}%)</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-medium mb-2">Resource Pledge Ledger (per-region totals)</h3>
        <table className="text-sm border-collapse">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-800">
              <th className="py-1 pr-6">Region</th>
              <th className="py-1 pr-6">Pledges Given</th>
              <th className="py-1 pr-6">Pledges Received</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.pledgeTotals).map(([regionId, totals]) => (
              <tr key={regionId} className="border-b border-slate-900">
                <td className="py-1 pr-6 font-medium">{regionId}</td>
                <td className="py-1 pr-6">{totals.given}</td>
                <td className="py-1 pr-6">{totals.received}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function FinalStat({ label, value, tone }: { label: string; value: string; tone?: "emerald" }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${tone === "emerald" ? "text-emerald-400" : ""}`}>{value}</p>
    </div>
  );
}
