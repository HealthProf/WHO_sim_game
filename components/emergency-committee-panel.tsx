"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { PillButton } from "@/components/ui/pill-button";

interface SnapVoteView {
  id: number;
  question: string;
  options: string[];
  closesAt: string;
  status: "open" | "closed";
  resultSummary: string | null;
  respondedCount: number;
  totalTeams: number;
  optionCounts?: Record<string, number>;
}

// Facilitator "break-glass" pacing tool — see lib/snap-vote.ts. Usable at any
// moment, independent of the scripted event queue, to recenter the room on
// a single synchronous question.
export function EmergencyCommitteePanel() {
  const qc = useQueryClient();
  const [question, setQuestion] = useState("");
  const [optionsText, setOptionsText] = useState("YES, NO");
  const [duration, setDuration] = useState(90);

  const { data } = useQuery({
    queryKey: ["instructor-snap-vote"],
    queryFn: () => apiFetch<{ current: SnapVoteView | null; history: SnapVoteView[] }>("/api/instructor/snap-vote"),
    refetchInterval: 4000,
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch("/api/instructor/snap-vote", {
        method: "POST",
        body: JSON.stringify({
          question,
          options: optionsText.split(",").map((o) => o.trim()).filter(Boolean),
          durationSeconds: duration,
        }),
      }),
    onSuccess: () => {
      setQuestion("");
      qc.invalidateQueries({ queryKey: ["instructor-snap-vote"] });
    },
  });

  const close = useMutation({
    mutationFn: (snapVoteId: number) => apiFetch("/api/instructor/snap-vote", { method: "PATCH", body: JSON.stringify({ snapVoteId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instructor-snap-vote"] }),
  });

  const current = data?.current;

  return (
    <section className="space-y-4 rounded-lg bg-surface p-5">
      <div>
        <h2 className="font-heading text-[21px] text-text">Emergency Committee — Snap Vote</h2>
        <p className="mt-1 text-xs text-neutral-600">
          A break-glass pacing tool, separate from the scripted event queue — call it any time to force a synchronous
          all-team response and recenter the room. Closing tallies participation/agreement and applies a small model
          effect automatically (near-unanimous eases media pressure; a split vote raises it; non-participating
          regions take a small tension hit).
        </p>
      </div>

      {current ? (
        <div className="space-y-2 rounded-lg bg-accent-100 p-4">
          <p className="font-semibold text-accent-900">{current.question}</p>
          <p className="text-sm text-accent-800">
            {current.respondedCount}/{current.totalTeams} regions responded — options: {current.options.join(" / ")}
          </p>
          {current.optionCounts && (
            <p className="text-xs text-accent-700">
              Live tally: {Object.entries(current.optionCounts).map(([opt, count]) => `${opt}: ${count}`).join(", ") || "none yet"}
            </p>
          )}
          <PillButton size="sm" tone="accent" onClick={() => close.mutate(current.id)} disabled={close.isPending}>
            Close & Tally Now
          </PillButton>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (question.trim()) create.mutate();
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-[240px] flex-1">
            <label className="text-xs text-neutral-600">Question</label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Do you authorize emergency IHR Article 12 powers, right now?"
              className="w-full rounded-full border-2 border-divider bg-bg px-4 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-600">Options (comma-separated)</label>
            <input
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              className="w-full rounded-full border-2 border-divider bg-bg px-4 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-600">Duration (seconds)</label>
            <input
              type="number"
              min={30}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-24 rounded-full border-2 border-divider bg-bg px-4 py-2 text-sm"
            />
          </div>
          <PillButton type="submit" tone="accent" disabled={create.isPending || !question.trim()}>
            Call Snap Vote
          </PillButton>
        </form>
      )}

      {data?.history && data.history.length > 0 && (
        <details className="text-xs text-neutral-600">
          <summary className="cursor-pointer">Recent results ({data.history.length})</summary>
          <div className="mt-2 space-y-1">
            {data.history.map((v) => (
              <p key={v.id}>
                &quot;{v.question}&quot; — {v.resultSummary} ({v.respondedCount}/{v.totalTeams} responded)
              </p>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
