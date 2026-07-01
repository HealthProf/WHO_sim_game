"use client";

import { useState } from "react";
import type { SummaryRound } from "@/lib/summary-report";

const tierColor: Record<string, string> = {
  OPTIMAL: "text-emerald-400 border-emerald-700",
  ADEQUATE: "text-blue-400 border-blue-700",
  INADEQUATE: "text-amber-400 border-amber-700",
  CRITICAL_FAILURE: "text-red-400 border-red-700",
};

// Click-through, one-round-per-panel viewer for the after-action summary.
// `large` renders projector-sized text for the public display.
export function SummaryReportViewer({ rounds, large = false }: { rounds: SummaryRound[]; large?: boolean }) {
  const [index, setIndex] = useState(0);

  if (rounds.length === 0) {
    return <p className={large ? "text-2xl text-slate-400" : "text-slate-400"}>No decisions were scored this session.</p>;
  }

  const round = rounds[Math.min(index, rounds.length - 1)];
  const titleSize = large ? "text-4xl" : "text-xl";
  const bodySize = large ? "text-xl" : "text-sm";
  const navSize = large ? "text-2xl px-6 py-3" : "text-sm px-3 py-1.5";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className={`rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-30 font-medium ${navSize}`}
        >
          ← Prev
        </button>
        <span className={`text-slate-400 ${large ? "text-2xl" : "text-sm"}`}>
          Round {index + 1} of {rounds.length}
        </span>
        <button
          onClick={() => setIndex((i) => Math.min(rounds.length - 1, i + 1))}
          disabled={index === rounds.length - 1}
          className={`rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-30 font-medium ${navSize}`}
        >
          Next →
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div>
          <p className={`text-slate-500 uppercase tracking-wide ${large ? "text-lg" : "text-xs"}`}>
            Day {round.day} · {round.category}
          </p>
          <h2 className={`font-semibold ${titleSize}`}>{round.title}</h2>
          <p className={`text-slate-400 mt-2 ${bodySize}`}>{round.narrativeMarkdown}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {round.entries.map((entry) => (
            <div key={entry.regionId} className={`border rounded-lg p-4 ${tierColor[entry.tier ?? ""] ?? "border-slate-700 text-slate-300"}`}>
              <div className="flex items-center justify-between">
                <span className={`font-semibold ${large ? "text-xl" : "text-base"} text-slate-100`}>{entry.regionId}</span>
                {entry.tier && <span className={`font-semibold ${large ? "text-lg" : "text-xs"}`}>{entry.tier.replace("_", " ")}</span>}
              </div>
              {entry.structuredChoice && (
                <p className={`text-slate-300 mt-1 ${bodySize}`}>Choice: {entry.structuredChoice}</p>
              )}
              {entry.resourceAllocationJson && (
                <p className={`text-slate-400 mt-1 ${large ? "text-base" : "text-xs"}`}>
                  Allocation: {JSON.stringify(entry.resourceAllocationJson)}
                </p>
              )}
              <p className={`text-slate-300 mt-2 ${bodySize} whitespace-pre-wrap`}>{entry.rationaleText}</p>
              {entry.impactDesc && (
                <p className={`text-slate-400 mt-2 italic ${large ? "text-base" : "text-xs"}`}>{entry.impactDesc}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
