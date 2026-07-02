"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/fetcher";

interface SnapVoteView {
  id: number;
  question: string;
  options: string[];
  closesAt: string;
  respondedCount: number;
  totalTeams: number;
  myChoice?: string | null;
}

// Team-facing Emergency Committee snap-vote banner. Polls faster than the
// rest of the dashboard (5s) since votes are short-lived (default 90s) — see
// lib/snap-vote.ts. Only shows response *counts* while open, never the
// breakdown, so teams can't herd-vote off what other regions picked.
export function TeamSnapVoteBanner() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["snap-vote"],
    queryFn: () => apiFetch<{ current: SnapVoteView | null }>("/api/snap-vote"),
    refetchInterval: 5000,
  });

  const vote = useMutation({
    mutationFn: (choice: string) => apiFetch("/api/snap-vote", { method: "POST", body: JSON.stringify({ snapVoteId: data?.current?.id, choice }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["snap-vote"] }),
  });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!data?.current) return null;
  const { current } = data;
  const remainingMs = Math.max(0, new Date(current.closesAt).getTime() - now);
  const seconds = Math.ceil(remainingMs / 1000);

  return (
    <section className="bg-red-950/60 border-2 border-red-600 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-red-300 font-semibold">Emergency Committee — Snap Vote</p>
        <p className="text-lg font-bold text-red-300 tabular-nums">{seconds}s</p>
      </div>
      <p className="text-base font-medium text-white">{current.question}</p>
      <div className="flex flex-wrap gap-2">
        {current.options.map((opt) => (
          <button
            key={opt}
            disabled={!!current.myChoice || vote.isPending || remainingMs <= 0}
            onClick={() => vote.mutate(opt)}
            className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-40 ${
              current.myChoice === opt ? "bg-red-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-white"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      <p className="text-xs text-red-300">
        {current.myChoice ? `Your team voted "${current.myChoice}" — waiting on others.` : "Your team hasn't responded yet."}{" "}
        {current.respondedCount}/{current.totalTeams} regions have responded so far.
      </p>
    </section>
  );
}
