"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { SummaryReportViewer } from "@/components/summary-report-viewer";
import { QueryError } from "@/components/query-error";
import { regionColors } from "@/lib/who-region-map";
import { TierChip } from "@/components/ui/chip";
import type { SummaryRound } from "@/lib/summary-report";
import type { FinalResults } from "@/lib/final-results";
import type { TeamChapter as FullTeamChapter } from "@/lib/team-chapter";

interface TeamHighlightEntry {
  eventId: string;
  eventTitle: string;
  tier: string;
  compositePct: number;
}

type TeamChapter = Pick<FullTeamChapter, "regionId" | "headline" | "narrative" | "tierCounts" | "totalDecisions" | "actualDeaths" | "deathsPrevented">;

interface DebriefData {
  modelStateHistory: { id: number; regionId: string; day: number; reason: string; createdAt: string; snapshotJson: { rt: number; cfrMultiplier: number } }[];
  evt006Allocations: { regionId: string; allocation: Record<string, number> | null }[];
  evt012Allocations: { regionId: string; allocation: Record<string, number> | null }[];
  mostConsequentialScores: { score: { tier: string; compositePct: number }; decision: { id: number; rationaleText: string } | undefined }[];
  teamHighlights: { regionId: string; strongest: TeamHighlightEntry[]; weakest: TeamHighlightEntry[] }[];
  pledgeTotals: Record<string, { given: number; received: number }>;
  finalResults: FinalResults;
  teamChapters: TeamChapter[];
}

export default function DebriefPage() {
  const { data, error, refetch } = useQuery({ queryKey: ["debrief"], queryFn: () => apiFetch<DebriefData>("/api/instructor/debrief") });
  const { data: summary } = useQuery({ queryKey: ["summary-report"], queryFn: () => apiFetch<{ rounds: SummaryRound[] }>("/api/summary-report") });

  if (error) return <QueryError error={error} onRetry={() => refetch()} label="debrief data" />;
  if (!data) return <p className="text-neutral-600">Loading debrief data...</p>;

  return (
    <div className="flex flex-col gap-[26px]">
      <h1 className="font-heading text-[32px] text-text">After-Action Debrief</h1>

      <section className="space-y-5 rounded-lg bg-surface p-6">
        <div>
          <h2 className="font-heading text-[21px] text-text">Final Results: Actual vs. Ideal Playthrough</h2>
          <p className="mt-1 text-sm text-neutral-700">
            &quot;Actual&quot; is what really happened in this session. &quot;Ideal&quot; is a parallel shadow simulation that
            received only the OPTIMAL-tier consequence at every decision point — a realistic ceiling on how much
            better this outcome could have been, not a theoretical zero.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <FinalStat label="Actual Confirmed" value={data.finalResults.totalActualConfirmed.toLocaleString()} />
          <FinalStat label="Actual Deaths" value={data.finalResults.totalActualDeaths.toLocaleString()} />
          <FinalStat label="Ideal Confirmed" value={data.finalResults.totalOptimalConfirmed.toLocaleString()} tone="sage" />
          <FinalStat label="Ideal Deaths" value={data.finalResults.totalOptimalDeaths.toLocaleString()} tone="sage" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-accent-100 p-4">
            <p className="text-xs uppercase tracking-wide text-accent-700">Infections That Could Have Been Prevented</p>
            <p className="mt-1 text-3xl font-bold text-accent-900">{data.finalResults.totalInfectionsPrevented.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-accent-100 p-4">
            <p className="text-xs uppercase tracking-wide text-accent-700">Deaths That Could Have Been Prevented</p>
            <p className="mt-1 text-3xl font-bold text-accent-900">{data.finalResults.totalDeathsPrevented.toLocaleString()}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-text">Per-Region Breakdown</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-divider text-left text-[12px] font-medium text-neutral-600">
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
                  <tr key={r.regionId} className="border-b border-divider">
                    <td className="py-2 pr-4 font-semibold text-text">
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: regionColors[r.regionId] }} />
                      {r.regionId}
                    </td>
                    <td className="py-2 pr-4">{r.actualConfirmed.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-accent-2-700">{r.optimalConfirmed.toLocaleString()}</td>
                    <td className="py-2 pr-4 font-semibold text-accent-700">{r.infectionsPrevented.toLocaleString()}</td>
                    <td className="py-2 pr-4">{r.actualDeaths.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-accent-2-700">{r.optimalDeaths.toLocaleString()}</td>
                    <td className="py-2 pr-4 font-semibold text-accent-800">{r.deathsPrevented.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-[21px] text-text">Chapters of History</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.teamChapters.map((c) => (
            <div key={c.regionId} className="space-y-2 rounded-lg bg-neutral-900 p-5">
              <p className="text-lg font-bold text-white">{c.headline}</p>
              <p className="text-xs text-neutral-300">{c.narrative}</p>
              <div className="flex gap-4 pt-1 text-xs text-neutral-400">
                <span>{c.totalDecisions} decisions</span>
                <span className="text-accent-2-400">{c.tierCounts.OPTIMAL ?? 0} optimal</span>
                <span className="text-accent-400">{c.deathsPrevented.toLocaleString()} deaths preventable</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-[21px] text-text">Round-by-Round Summary</h2>
        {summary ? <SummaryReportViewer rounds={summary.rounds} /> : <p className="text-neutral-600">Loading...</p>}
      </section>

      <section>
        <h2 className="mb-2 font-heading text-[21px] text-text">Model State Trajectory (full history)</h2>
        <div className="max-h-64 space-y-1 overflow-y-auto text-xs">
          {data.modelStateHistory.map((h) => (
            <p key={h.id} className="text-neutral-600">
              Day {h.day} - {h.regionId}: Rt {h.snapshotJson.rt?.toFixed(2)}, CFR x{h.snapshotJson.cfrMultiplier?.toFixed(2)} — {h.reason}
            </p>
          ))}
          {data.modelStateHistory.length === 0 && <p className="text-neutral-500">No scored decisions yet.</p>}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-heading text-[21px] text-text">EVT-006 vs EVT-012 Allocation Comparison</h2>
        <div className="grid grid-cols-1 gap-6 text-sm sm:grid-cols-2">
          <div>
            <p className="mb-1 text-neutral-600">EVT-006 (first tranche)</p>
            {data.evt006Allocations.map((a) => (
              <p key={a.regionId} className="text-xs text-neutral-700">{a.regionId}: {a.allocation ? JSON.stringify(a.allocation) : "no submission"}</p>
            ))}
          </div>
          <div>
            <p className="mb-1 text-neutral-600">EVT-012 (second tranche)</p>
            {data.evt012Allocations.map((a) => (
              <p key={a.regionId} className="text-xs text-neutral-700">{a.regionId}: {a.allocation ? JSON.stringify(a.allocation) : "no submission"}</p>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-heading text-[21px] text-text">Most Consequential Decisions</h2>
        {data.mostConsequentialScores.map((s, i) => (
          <div key={i} className="mb-2 flex items-start gap-2 text-xs text-neutral-600">
            <TierChip tier={s.score.tier} /> <span>({s.score.compositePct.toFixed(0)}%) — {s.decision?.rationaleText.slice(0, 140)}...</span>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-3 font-heading text-[21px] text-text">Per-Team Highlights (3 strongest / 3 weakest)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.teamHighlights.map((h) => (
            <div key={h.regionId} className="space-y-2 rounded-lg bg-surface p-4 text-xs">
              <p className="text-sm font-semibold text-text">{h.regionId}</p>
              <div>
                <p className="mb-1 font-medium text-accent-2-700">Strongest</p>
                {h.strongest.length === 0 && <p className="text-neutral-500">No scored decisions yet.</p>}
                {h.strongest.map((e, i) => (
                  <p key={i} className="text-neutral-700">{e.eventId} — {e.eventTitle} ({e.tier.replace("_", " ")}, {e.compositePct.toFixed(0)}%)</p>
                ))}
              </div>
              <div>
                <p className="mb-1 font-medium text-accent-800">Weakest</p>
                {h.weakest.length === 0 && <p className="text-neutral-500">Not enough distinct decisions.</p>}
                {h.weakest.map((e, i) => (
                  <p key={i} className="text-neutral-700">{e.eventId} — {e.eventTitle} ({e.tier.replace("_", " ")}, {e.compositePct.toFixed(0)}%)</p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-heading text-[21px] text-text">Resource Pledge Ledger (per-region totals)</h2>
        <table className="border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-divider text-left text-[12px] font-medium text-neutral-600">
              <th className="py-1 pr-6">Region</th>
              <th className="py-1 pr-6">Pledges Given</th>
              <th className="py-1 pr-6">Pledges Received</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.pledgeTotals).map(([regionId, totals]) => (
              <tr key={regionId} className="border-b border-divider">
                <td className="py-1 pr-6 font-semibold text-text">{regionId}</td>
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

function FinalStat({ label, value, tone }: { label: string; value: string; tone?: "sage" }) {
  return (
    <div className="rounded-md bg-bg p-3">
      <p className="text-xs text-neutral-600">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone === "sage" ? "text-accent-2-700" : "text-text"}`}>{value}</p>
    </div>
  );
}
