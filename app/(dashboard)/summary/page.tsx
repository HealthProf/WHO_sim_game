"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { SummaryReportViewer } from "@/components/summary-report-viewer";
import type { SummaryRound } from "@/lib/summary-report";
import type { FinalResults } from "@/lib/final-results";
import type { TeamChapter } from "@/lib/team-chapter";

interface TeamHighlightEntry {
  eventId: string;
  eventTitle: string;
  tier: string;
  compositePct: number;
}

interface MyHighlights {
  regionId: string;
  strongest: TeamHighlightEntry[];
  weakest: TeamHighlightEntry[];
}


export default function TeamSummaryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["summary-report"],
    queryFn: () =>
      apiFetch<{ rounds: SummaryRound[]; myHighlights: MyHighlights | null; finalResults: FinalResults; myChapter: TeamChapter | null }>("/api/summary-report"),
  });

  const myRegionResult = data?.myHighlights ? data.finalResults.regions.find((r) => r.regionId === data.myHighlights!.regionId) : null;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">After-Action Summary</h1>
        <p className="text-sm text-slate-400 mt-1">
          Every region&apos;s decision, rationale, and resulting consequence, round by round. Click through to see
          how each region approached the same events.
        </p>
      </div>

      {data?.myChapter && (
        <section className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-6 space-y-3">
          <p className="text-xs uppercase tracking-widest text-slate-500">Your Chapter</p>
          <h2 className="text-2xl font-bold text-white">{data.myChapter.headline}</h2>
          <p className="text-sm text-slate-300">{data.myChapter.narrative}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm pt-2">
            <div className="bg-slate-800/60 rounded-lg p-3">
              <p className="text-xs text-slate-500">Decisions Scored</p>
              <p className="text-lg font-bold">{data.myChapter.totalDecisions}</p>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-3">
              <p className="text-xs text-slate-500">Optimal Calls</p>
              <p className="text-lg font-bold text-emerald-400">{data.myChapter.tierCounts.OPTIMAL ?? 0}</p>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-3">
              <p className="text-xs text-slate-500">Final Deaths</p>
              <p className="text-lg font-bold">{data.myChapter.actualDeaths.toLocaleString()}</p>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-3">
              <p className="text-xs text-slate-500">Deaths Prevented vs. Ideal</p>
              <p className="text-lg font-bold text-red-400">{data.myChapter.deathsPrevented.toLocaleString()}</p>
            </div>
          </div>
          {data.myChapter.keyDecisions.length > 0 && (
            <div className="pt-2">
              <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Defining Moments</p>
              {data.myChapter.keyDecisions.map((d, i) => (
                <p key={i} className="text-xs text-slate-400">{d.eventId} — {d.eventTitle} ({d.tier.replace("_", " ")}, {d.compositePct.toFixed(0)}%)</p>
              ))}
            </div>
          )}
        </section>
      )}

      {data?.finalResults && (
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <h2 className="font-medium">Final Results: Actual vs. Ideal Playthrough</h2>
          <p className="text-xs text-slate-400">
            &quot;Ideal&quot; is a parallel shadow simulation that received only the best-tier consequence at every
            decision point across every region — a realistic ceiling on what this session could have achieved.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-500">World Confirmed (actual)</p>
              <p className="text-lg font-bold">{data.finalResults.totalActualConfirmed.toLocaleString()}</p>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3">
              <p className="text-xs text-slate-500">World Deaths (actual)</p>
              <p className="text-lg font-bold">{data.finalResults.totalActualDeaths.toLocaleString()}</p>
            </div>
            <div className="bg-amber-950/40 border border-amber-800 rounded-lg p-3">
              <p className="text-xs text-amber-300">Infections Preventable</p>
              <p className="text-lg font-bold">{data.finalResults.totalInfectionsPrevented.toLocaleString()}</p>
            </div>
            <div className="bg-red-950/40 border border-red-800 rounded-lg p-3">
              <p className="text-xs text-red-300">Deaths Preventable</p>
              <p className="text-lg font-bold">{data.finalResults.totalDeathsPrevented.toLocaleString()}</p>
            </div>
          </div>
          {myRegionResult && (
            <p className="text-xs text-slate-400">
              Your region ({myRegionResult.regionId}): {myRegionResult.actualConfirmed.toLocaleString()} confirmed /{" "}
              {myRegionResult.actualDeaths.toLocaleString()} deaths actual, vs. {myRegionResult.optimalConfirmed.toLocaleString()} /{" "}
              {myRegionResult.optimalDeaths.toLocaleString()} under an ideal playthrough.
            </p>
          )}
        </section>
      )}

      {data?.myHighlights && (
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-emerald-400 font-medium mb-2">Your 3 Strongest Decisions</p>
            {data.myHighlights.strongest.length === 0 && <p className="text-slate-500 text-xs">No scored decisions yet.</p>}
            {data.myHighlights.strongest.map((e, i) => (
              <p key={i} className="text-slate-300 text-xs mb-1">{e.eventId} — {e.eventTitle} ({e.tier.replace("_", " ")}, {e.compositePct.toFixed(0)}%)</p>
            ))}
          </div>
          <div>
            <p className="text-red-400 font-medium mb-2">Your 3 Weakest Decisions</p>
            {data.myHighlights.weakest.length === 0 && <p className="text-slate-500 text-xs">Not enough distinct decisions yet.</p>}
            {data.myHighlights.weakest.map((e, i) => (
              <p key={i} className="text-slate-300 text-xs mb-1">{e.eventId} — {e.eventTitle} ({e.tier.replace("_", " ")}, {e.compositePct.toFixed(0)}%)</p>
            ))}
          </div>
        </section>
      )}

      {isLoading || !data ? (
        <p className="text-slate-400">Loading summary...</p>
      ) : (
        <SummaryReportViewer rounds={data.rounds} />
      )}
    </div>
  );
}
