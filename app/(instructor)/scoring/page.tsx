"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { QueryError } from "@/components/query-error";
import { PillButton, PillLink } from "@/components/ui/pill-button";

interface InboxItem {
  decision: { id: number; teamId: number; submittedAt: string; structuredChoice: string | null; confidenceLevel: string | null };
  event: { id: string; title: string; requiresMandatoryReview: boolean } | null;
  team: { regionId: string } | null;
  suggestedTier: string | null;
  mandatoryReview: boolean;
  ageMs: number;
  deadlineRemainingMs: number;
}

export default function ScoringInboxPage() {
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
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

  if (error) return <QueryError error={error} onRetry={() => refetch()} label="scoring inbox" />;
  if (isLoading || !data) return <p className="text-neutral-600">Loading inbox...</p>;

  const oldest = data.inbox.length ? Math.max(...data.inbox.map((i) => i.ageMs)) : 0;
  const fastPathable = data.inbox.filter((i) => !i.mandatoryReview && i.suggestedTier);

  return (
    <div className="flex flex-col gap-[26px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-[32px] text-text">
          Scoring — {data.inbox.length} awaiting, oldest {Math.round(oldest / 60000)}m
        </h1>
        {fastPathable.length > 0 && (
          <PillButton size="sm" tone="sage" onClick={() => bulkAccept.mutate(fastPathable.map((i) => i.decision.id))}>
            Accept all suggested ({fastPathable.length})
          </PillButton>
        )}
      </div>

      <div className="space-y-3">
        {data.inbox.map((item) => (
          <div key={item.decision.id} className={`rounded-lg p-4 ${item.mandatoryReview ? "bg-accent-100" : "bg-surface"}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-text">
                  {item.event?.title ?? "?"} <span className="text-xs font-normal text-neutral-600">({item.team?.regionId})</span>
                </p>
                <p className="mt-1 text-xs text-neutral-600">
                  Choice: {item.decision.structuredChoice ?? "-"} - Confidence: {item.decision.confidenceLevel ?? "n/a"} - Suggested
                  tier: {item.suggestedTier ?? "n/a"} - Age: {Math.round(item.ageMs / 60000)}m
                </p>
                {item.mandatoryReview && <p className="mt-1 text-xs font-semibold text-accent-800">MANDATORY REVIEW — cannot fast-path</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                {!item.mandatoryReview && item.suggestedTier && (
                  <PillButton size="sm" tone="sage" onClick={() => acceptOne.mutate(item.decision.id)}>
                    Accept Suggested
                  </PillButton>
                )}
                <PillLink href={`/scoring/${item.decision.id}`} size="sm" tone="accent">
                  Score Manually
                </PillLink>
              </div>
            </div>
          </div>
        ))}
        {data.inbox.length === 0 && <p className="text-sm text-neutral-600">Inbox is empty.</p>}
      </div>
    </div>
  );
}
