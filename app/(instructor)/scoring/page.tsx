"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import Link from "next/link";

interface InboxItem {
  decision: { id: number; teamId: number; submittedAt: string; structuredChoice: string | null };
  event: { id: string; title: string; requiresMandatoryReview: boolean } | null;
  team: { regionId: string } | null;
  suggestedTier: string | null;
  mandatoryReview: boolean;
  ageMs: number;
  deadlineRemainingMs: number;
}

export default function ScoringInboxPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["scoring-inbox"],
    queryFn: () => apiFetch<{ inbox: InboxItem[] }>("/api/scores"),
    refetchInterval: 8000,
  });

  const bulkAccept = useMutation({
    mutationFn: (decisionIds: number[]) =>
      apiFetch("/api/scores/bulk-accept", { method: "POST", body: JSON.stringify({ decisionIds }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scoring-inbox"] }),
  });

  const acceptOne = useMutation({
    mutationFn: (decisionId: number) => apiFetch("/api/scores", { method: "POST", body: JSON.stringify({ decisionId, acceptSuggested: true }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scoring-inbox"] }),
  });

  if (isLoading || !data) return <p className="text-slate-400">Loading inbox...</p>;

  const oldest = data.inbox.length ? Math.max(...data.inbox.map((i) => i.ageMs)) : 0;
  const fastPathable = data.inbox.filter((i) => !i.mandatoryReview && i.suggestedTier);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Scoring Inbox — {data.inbox.length} awaiting, oldest {Math.round(oldest / 60000)}m
        </h2>
        {fastPathable.length > 0 && (
          <button
            onClick={() => bulkAccept.mutate(fastPathable.map((i) => i.decision.id))}
            className="rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-3 py-1.5"
          >
            Accept all suggested ({fastPathable.length})
          </button>
        )}
      </div>

      <div className="space-y-3">
        {data.inbox.map((item) => (
          <div
            key={item.decision.id}
            className={`bg-slate-900 border rounded-lg p-4 ${item.mandatoryReview ? "border-red-600" : "border-slate-800"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">
                  {item.event?.title ?? "?"} <span className="text-xs text-slate-500">({item.team?.regionId})</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Choice: {item.decision.structuredChoice ?? "-"} - Suggested tier: {item.suggestedTier ?? "n/a"} - Age:{" "}
                  {Math.round(item.ageMs / 60000)}m
                </p>
                {item.mandatoryReview && <p className="text-xs text-red-400 mt-1 font-semibold">MANDATORY REVIEW — cannot fast-path</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                {!item.mandatoryReview && item.suggestedTier && (
                  <button
                    onClick={() => acceptOne.mutate(item.decision.id)}
                    className="rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5"
                  >
                    Accept Suggested
                  </button>
                )}
                <Link
                  href={`/scoring/${item.decision.id}`}
                  className="rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5"
                >
                  Score Manually
                </Link>
              </div>
            </div>
          </div>
        ))}
        {data.inbox.length === 0 && <p className="text-slate-500 text-sm">Inbox is empty.</p>}
      </div>
    </div>
  );
}
