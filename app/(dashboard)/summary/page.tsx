"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { SummaryReportViewer } from "@/components/summary-report-viewer";
import type { SummaryRound } from "@/lib/summary-report";

export default function TeamSummaryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["summary-report"],
    queryFn: () => apiFetch<{ rounds: SummaryRound[] }>("/api/summary-report"),
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
      {isLoading || !data ? (
        <p className="text-slate-400">Loading summary...</p>
      ) : (
        <SummaryReportViewer rounds={data.rounds} />
      )}
    </div>
  );
}
