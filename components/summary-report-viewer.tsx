"use client";

import { useState } from "react";
import type { SummaryRound } from "@/lib/summary-report";
import { TierChip } from "@/components/ui/chip";
import { PillButton } from "@/components/ui/pill-button";

// Click-through, one-round-per-panel viewer for the after-action summary.
// `large` renders projector-sized text for the public display, which is
// also the app's one full-bleed dark surface — everywhere else (team
// summary, instructor debrief) is the light card system.
export function SummaryReportViewer({ rounds, large = false }: { rounds: SummaryRound[]; large?: boolean }) {
  const [index, setIndex] = useState(0);

  const mutedText = large ? "text-neutral-400" : "text-neutral-700";
  if (rounds.length === 0) {
    return <p className={large ? `text-2xl ${mutedText}` : mutedText}>No decisions were scored this session.</p>;
  }

  const round = rounds[Math.min(index, rounds.length - 1)];
  const titleSize = large ? "text-4xl" : "text-[21px]";
  const bodySize = large ? "text-xl" : "text-sm";
  const navSize = large ? "text-2xl" : "text-sm";
  const cardBg = large ? "bg-neutral-800" : "bg-bg";
  const panelBg = large ? "bg-neutral-900" : "bg-surface";
  const headingText = large ? "text-white" : "text-text";
  const bodyText = large ? "text-neutral-300" : "text-neutral-700";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <PillButton
          tone={large ? "ghost-dark" : "ghost"}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className={navSize}
        >
          ← Prev
        </PillButton>
        <span className={`${mutedText} ${large ? "text-2xl" : "text-sm"}`}>
          Round {index + 1} of {rounds.length}
        </span>
        <PillButton
          tone={large ? "ghost-dark" : "ghost"}
          onClick={() => setIndex((i) => Math.min(rounds.length - 1, i + 1))}
          disabled={index === rounds.length - 1}
          className={navSize}
        >
          Next →
        </PillButton>
      </div>

      <div className={`space-y-4 rounded-lg p-6 ${panelBg}`}>
        <div>
          <p className={`uppercase tracking-wide ${mutedText} ${large ? "text-lg" : "text-xs"}`}>
            Day {round.day} · {round.category}
          </p>
          <h2 className={`font-heading ${titleSize} ${headingText}`}>{round.title}</h2>
          <p className={`mt-2 ${bodySize} ${bodyText}`}>{round.narrativeMarkdown}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {round.entries.map((entry) => (
            <div key={entry.regionId} className={`rounded-lg p-4 ${cardBg}`}>
              <div className="flex items-center justify-between">
                <span className={`font-semibold ${large ? "text-xl" : "text-base"} ${headingText}`}>{entry.regionId}</span>
                {entry.tier && <TierChip tier={entry.tier} />}
              </div>
              {entry.structuredChoice && (
                <p className={`mt-1 ${bodySize} ${bodyText}`}>Choice: {entry.structuredChoice}</p>
              )}
              {entry.resourceAllocationJson && (
                <p className={`mt-1 ${mutedText} ${large ? "text-base" : "text-xs"}`}>
                  Allocation: {JSON.stringify(entry.resourceAllocationJson)}
                </p>
              )}
              <p className={`mt-2 whitespace-pre-wrap ${bodySize} ${bodyText}`}>{entry.rationaleText}</p>
              {entry.impactDesc && (
                <p className={`mt-2 italic ${mutedText} ${large ? "text-base" : "text-xs"}`}>{entry.impactDesc}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
