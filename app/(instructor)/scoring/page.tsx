"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { QueryError } from "@/components/query-error";
import { PillButton, PillLink } from "@/components/ui/pill-button";
import { TierChip } from "@/components/ui/chip";

interface Provisional {
  scores: { evidenceScore: number; politicalScore: number; equityScore: number };
  tier: string;
  reasons: string[];
  needsReview: boolean;
  reviewReason: string | null;
}

interface InboxItem {
  decision: { id: number; teamId: number; submittedAt: string; structuredChoice: string | null; confidenceLevel: string | null };
  event: { id: string; title: string } | null;
  team: { regionId: string } | null;
  provisional: Provisional | null;
  needsReview: boolean;
  ageMs: number;
}

interface DashState {
  globalState: { autoAcceptScores: boolean };
}

// Release 2 scoring inbox: every submission arrives with a rule-based
// provisional grade (lib/auto-grade.ts). "Accept all" applies the ones that
// don't need review in one click; items that need review (critical
// failures, mandatory-review events) stay until you open them, or until you
// explicitly include them.
export default function ScoringInboxPage() {
  const qc = useQueryClient();
  const [includeReview, setIncludeReview] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["scoring-inbox"],
    queryFn: () => apiFetch<{ inbox: InboxItem[] }>("/api/scores"),
    refetchInterval: 8000,
  });
  const { data: dash } = useQuery({ queryKey: ["dashboard"], queryFn: () => apiFetch<DashState>("/api/dashboard"), refetchInterval: 10000 });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["scoring-inbox"] });
    qc.invalidateQueries({ queryKey: ["events"] });
  };
  const bulkAccept = useMutation({
    mutationFn: ({ ids, withReview }: { ids: number[]; withReview: boolean }) =>
      apiFetch<{ results: { ok: boolean }[] }>("/api/scores/bulk-accept", {
        method: "POST",
        body: JSON.stringify({ decisionIds: ids, includeReview: withReview }),
      }),
    onSuccess: invalidate,
  });
  const acceptOne = useMutation({
    mutationFn: (decisionId: number) =>
      apiFetch("/api/scores", { method: "POST", body: JSON.stringify({ decisionId, acceptProvisional: true }) }),
    onSuccess: invalidate,
  });
  const setAutoAccept = useMutation({
    mutationFn: (on: boolean) => apiFetch("/api/instructor/settings", { method: "PATCH", body: JSON.stringify({ autoAcceptScores: on }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
  });

  if (error) return <QueryError error={error} onRetry={() => refetch()} label="scoring inbox" />;
  if (isLoading || !data) return <p className="text-neutral-700">Loading inbox...</p>;

  const oldest = data.inbox.length ? Math.max(...data.inbox.map((i) => i.ageMs)) : 0;
  const ready = data.inbox.filter((i) => i.provisional && !i.needsReview);
  const review = data.inbox.filter((i) => i.needsReview);
  const bulkIds = (includeReview ? data.inbox : ready).map((i) => i.decision.id);

  function acceptAll() {
    if (includeReview && review.length > 0) {
      const ok = window.confirm(
        `This also accepts ${review.length} grade${review.length === 1 ? "" : "s"} the decision matrix marks for mandatory review (critical failures or flagged events) without you reading them. Continue?`
      );
      if (!ok) return;
    }
    bulkAccept.mutate({ ids: bulkIds, withReview: includeReview });
  }

  return (
    <div className="flex flex-col gap-[26px]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-[32px] text-text">Scoring</h1>
          <p className="text-sm text-neutral-800">
            {data.inbox.length} awaiting · {ready.length} ready to accept · {review.length} need your review
            {data.inbox.length > 0 && ` · oldest ${Math.round(oldest / 60000)}m`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <PillButton tone="sage" onClick={acceptAll} disabled={bulkIds.length === 0 || bulkAccept.isPending}>
            {bulkAccept.isPending ? "Accepting…" : `Accept all provisional grades (${bulkIds.length})`}
          </PillButton>
          <label className="flex items-center gap-2 text-xs text-neutral-800">
            <input type="checkbox" checked={includeReview} onChange={(e) => setIncludeReview(e.target.checked)} />
            Include items that need review
          </label>
        </div>
      </div>

      <section className="flex flex-wrap items-center gap-3 rounded-lg bg-surface p-4 text-sm">
        <label className="flex items-center gap-2 font-semibold text-text">
          <input
            type="checkbox"
            checked={!!dash?.globalState.autoAcceptScores}
            onChange={(e) => setAutoAccept.mutate(e.target.checked)}
            disabled={setAutoAccept.isPending}
          />
          Auto-accept provisional grades
        </label>
        <span className="text-neutral-700">
          When on, each submission is scored with its provisional grade about a minute after it arrives, so later events
          aren&apos;t held up waiting for you. Items that need review are never auto-accepted.
        </span>
      </section>

      <div className="space-y-3">
        {data.inbox.map((item) => {
          const p = item.provisional;
          return (
            <div key={item.decision.id} className={`rounded-lg p-4 ${item.needsReview ? "bg-accent-100" : "bg-surface"}`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-text">
                    {item.event?.title ?? "?"} <span className="text-xs font-normal text-neutral-700">({item.team?.regionId})</span>
                    {p && <TierChip tier={p.tier} />}
                    {p && (
                      <span className="text-xs font-normal text-neutral-700">
                        E{p.scores.evidenceScore} · P{p.scores.politicalScore} · Eq{p.scores.equityScore}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-neutral-700">
                    Choice: {item.decision.structuredChoice ?? "none"} · Confidence: {item.decision.confidenceLevel ?? "n/a"} · Age:{" "}
                    {Math.round(item.ageMs / 60000)}m
                  </p>
                  {p && p.reasons.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-xs text-neutral-800">
                      {p.reasons.map((r) => (
                        <li key={r}>• {r}</li>
                      ))}
                    </ul>
                  )}
                  {item.needsReview && p?.reviewReason && <p className="mt-1.5 text-xs font-semibold text-accent-800">Needs review: {p.reviewReason}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  {p && !item.needsReview && (
                    <PillButton size="sm" tone="sage" onClick={() => acceptOne.mutate(item.decision.id)} disabled={acceptOne.isPending}>
                      Accept
                    </PillButton>
                  )}
                  <PillLink href={`/scoring/${item.decision.id}`} size="sm" tone={item.needsReview ? "accent" : "ghost"}>
                    {item.needsReview ? "Review" : "Adjust"}
                  </PillLink>
                </div>
              </div>
            </div>
          );
        })}
        {data.inbox.length === 0 && <p className="text-sm text-neutral-700">Inbox is empty.</p>}
      </div>
    </div>
  );
}
