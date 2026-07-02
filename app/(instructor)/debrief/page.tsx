"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { SummaryReportViewer } from "@/components/summary-report-viewer";
import { QueryError } from "@/components/query-error";
import type { SummaryRound } from "@/lib/summary-report";

interface TeamHighlightEntry {
  eventId: string;
  eventTitle: string;
  tier: string;
  compositePct: number;
}

interface DebriefData {
  modelStateHistory: { id: number; regionId: string; day: number; reason: string; createdAt: string; snapshotJson: { rt: number; cfrMultiplier: number } }[];
  evt006Allocations: { regionId: string; allocation: Record<string, number> | null }[];
  evt012Allocations: { regionId: string; allocation: Record<string, number> | null }[];
  mostConsequentialScores: { score: { tier: string; compositePct: number }; decision: { id: number; rationaleText: string } | undefined }[];
  teamHighlights: { regionId: string; strongest: TeamHighlightEntry[]; weakest: TeamHighlightEntry[] }[];
  pledgeTotals: Record<string, { given: number; received: number }>;
}

export default function DebriefPage() {
  const { data, error, refetch } = useQuery({ queryKey: ["debrief"], queryFn: () => apiFetch<DebriefData>("/api/instructor/debrief") });
  const { data: summary } = useQuery({ queryKey: ["summary-report"], queryFn: () => apiFetch<{ rounds: SummaryRound[] }>("/api/summary-report") });

  if (error) return <QueryError error={error} onRetry={() => refetch()} label="debrief data" />;
  if (!data) return <p className="text-slate-400">Loading debrief data...</p>;

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-semibold">After-Action Debrief</h2>

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
