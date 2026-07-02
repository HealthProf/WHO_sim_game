"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { SummaryReportViewer } from "@/components/summary-report-viewer";
import type { SummaryRound } from "@/lib/summary-report";

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
    queryFn: () => apiFetch<{ rounds: SummaryRound[]; myHighlights: MyHighlights | null }>("/api/summary-report"),
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">After-Action Summary</h1>
        <p className="text-sm text-slate-400 mt-1">
          Every region&apos;s decision, rationale, and resulting consequence, round by round. Click through to see
          how each region approached the same events.
        </p>
      </div>

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
