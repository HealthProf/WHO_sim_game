"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { SummaryReportViewer } from "@/components/summary-report-viewer";
import { TierChip } from "@/components/ui/chip";
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
    <div className="flex max-w-4xl flex-col gap-[26px]">
      <div>
        <h1 className="font-heading text-[32px] text-text">After-Action Summary</h1>
        <p className="mt-1 text-sm text-neutral-700">
          Every region&apos;s decision, rationale, and resulting consequence, round by round. Click through to see
          how each region approached the same events.
        </p>
      </div>

      {data?.myChapter && (
        <section className="space-y-3 rounded-lg bg-neutral-900 p-6">
          <p className="text-xs uppercase tracking-widest text-neutral-500">Your Chapter</p>
          <h2 className="font-heading text-2xl text-white">{data.myChapter.headline}</h2>
          <p className="text-sm text-neutral-300">{data.myChapter.narrative}</p>
          <div className="grid grid-cols-2 gap-3 pt-2 text-sm sm:grid-cols-4">
            <div className="rounded-md bg-neutral-800 p-3">
              <p className="text-xs text-neutral-400">Decisions Scored</p>
              <p className="text-lg font-bold text-white">{data.myChapter.totalDecisions}</p>
            </div>
            <div className="rounded-md bg-neutral-800 p-3">
              <p className="text-xs text-neutral-400">Optimal Calls</p>
              <p className="text-lg font-bold text-accent-2-400">{data.myChapter.tierCounts.OPTIMAL ?? 0}</p>
            </div>
            <div className="rounded-md bg-neutral-800 p-3">
              <p className="text-xs text-neutral-400">Final Deaths</p>
              <p className="text-lg font-bold text-white">{data.myChapter.actualDeaths.toLocaleString()}</p>
            </div>
            <div className="rounded-md bg-neutral-800 p-3">
              <p className="text-xs text-neutral-400">Deaths Prevented vs. Ideal</p>
              <p className="text-lg font-bold text-accent-400">{data.myChapter.deathsPrevented.toLocaleString()}</p>
            </div>
          </div>
          {data.myChapter.keyDecisions.length > 0 && (
            <div className="pt-2">
              <p className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Defining Moments</p>
              {data.myChapter.keyDecisions.map((d, i) => (
                <p key={i} className="text-xs text-neutral-400">{d.eventId} — {d.eventTitle} ({d.tier.replace("_", " ")}, {d.compositePct.toFixed(0)}%)</p>
              ))}
            </div>
          )}
        </section>
      )}

      {data?.finalResults && (
        <section className="space-y-3 rounded-lg bg-surface p-5">
          <h2 className="font-heading text-[21px] text-text">Final Results: Actual vs. Ideal Playthrough</h2>
          <p className="text-xs text-neutral-700">
            &quot;Ideal&quot; is a parallel shadow simulation that received only the best-tier consequence at every
            decision point across every region — a realistic ceiling on what this session could have achieved.
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-md bg-bg p-3">
              <p className="text-xs text-neutral-700">World Confirmed (actual)</p>
              <p className="text-lg font-bold text-text">{data.finalResults.totalActualConfirmed.toLocaleString()}</p>
            </div>
            <div className="rounded-md bg-bg p-3">
              <p className="text-xs text-neutral-700">World Deaths (actual)</p>
              <p className="text-lg font-bold text-text">{data.finalResults.totalActualDeaths.toLocaleString()}</p>
            </div>
            <div className="rounded-md bg-accent-100 p-3">
              <p className="text-xs text-accent-700">Infections Preventable</p>
              <p className="text-lg font-bold text-accent-900">{data.finalResults.totalInfectionsPrevented.toLocaleString()}</p>
            </div>
            <div className="rounded-md bg-accent-100 p-3">
              <p className="text-xs text-accent-700">Deaths Preventable</p>
              <p className="text-lg font-bold text-accent-900">{data.finalResults.totalDeathsPrevented.toLocaleString()}</p>
            </div>
          </div>
          {myRegionResult && (
            <p className="text-xs text-neutral-700">
              Your region ({myRegionResult.regionId}): {myRegionResult.actualConfirmed.toLocaleString()} confirmed /{" "}
              {myRegionResult.actualDeaths.toLocaleString()} deaths actual, vs. {myRegionResult.optimalConfirmed.toLocaleString()} /{" "}
              {myRegionResult.optimalDeaths.toLocaleString()} under an ideal playthrough.
            </p>
          )}
        </section>
      )}

      {data?.myHighlights && (
        <section className="grid gap-4 rounded-lg bg-surface p-5 text-sm sm:grid-cols-2">
          <div>
            <p className="mb-2 font-semibold text-accent-2-700">Your 3 Strongest Decisions</p>
            {data.myHighlights.strongest.length === 0 && <p className="text-xs text-neutral-700">No scored decisions yet.</p>}
            {data.myHighlights.strongest.map((e, i) => (
              <div key={i} className="mb-1.5 flex items-center gap-2">
                <TierChip tier={e.tier} />
                <span className="text-xs text-neutral-700">{e.eventId} — {e.eventTitle} ({e.compositePct.toFixed(0)}%)</span>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-2 font-semibold text-accent-800">Your 3 Weakest Decisions</p>
            {data.myHighlights.weakest.length === 0 && <p className="text-xs text-neutral-700">Not enough distinct decisions yet.</p>}
            {data.myHighlights.weakest.map((e, i) => (
              <div key={i} className="mb-1.5 flex items-center gap-2">
                <TierChip tier={e.tier} />
                <span className="text-xs text-neutral-700">{e.eventId} — {e.eventTitle} ({e.compositePct.toFixed(0)}%)</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {isLoading || !data ? (
        <p className="text-neutral-700">Loading summary...</p>
      ) : (
        <SummaryReportViewer rounds={data.rounds} />
      )}
    </div>
  );
}
