"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

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
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Emergency Committee — Snap Vote</h2>
        <p className="text-xs text-slate-500 mt-1">
          A break-glass pacing tool, separate from the scripted event queue — call it any time to force a synchronous
          all-team response and recenter the room. Closing tallies participation/agreement and applies a small model
          effect automatically (near-unanimous eases media pressure; a split vote raises it; non-participating
          regions take a small tension hit).
        </p>
      </div>

      {current ? (
        <div className="bg-red-950/40 border border-red-800 rounded-lg p-4 space-y-2">
          <p className="font-medium">{current.question}</p>
          <p className="text-sm text-slate-300">
            {current.respondedCount}/{current.totalTeams} regions responded — options: {current.options.join(" / ")}
          </p>
          {current.optionCounts && (
            <p className="text-xs text-slate-400">
              Live tally: {Object.entries(current.optionCounts).map(([opt, count]) => `${opt}: ${count}`).join(", ") || "none yet"}
            </p>
          )}
          <button
            onClick={() => close.mutate(current.id)}
            disabled={close.isPending}
            className="rounded-md bg-red-700 hover:bg-red-600 text-white text-xs font-medium px-3 py-1.5"
          >
            Close & Tally Now
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (question.trim()) create.mutate();
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="flex-1 min-w-[240px]">
            <label className="text-xs text-slate-500">Question</label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Do you authorize emergency IHR Article 12 powers, right now?"
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Options (comma-separated)</label>
            <input
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Duration (seconds)</label>
            <input
              type="number"
              min={30}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-24 rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={create.isPending || !question.trim()}
            className="rounded-md bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-sm font-medium px-4 py-2"
          >
            Call Snap Vote
          </button>
        </form>
      )}

      {data?.history && data.history.length > 0 && (
        <details className="text-xs text-slate-400">
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
