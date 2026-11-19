"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { computePacing, type PacingDispatch, type PacingEvent, type PacingStatus, type Recommendation } from "@/lib/pacing";
import type { GlobalClockFields } from "@/lib/sim-clock";
import { PillButton } from "@/components/ui/pill-button";
import { Chip, type ChipTone } from "@/components/ui/chip";

const STATUS_LABEL: Record<PacingStatus, string> = {
  not_started: "Not started",
  on_track: "On track",
  behind: "Behind",
  ahead: "Ahead",
  all_fired: "All required events fired",
};
const STATUS_TONE: Record<PacingStatus, ChipTone> = {
  not_started: "neutral-soft",
  on_track: "sage-soft",
  behind: "accent-solid",
  ahead: "neutral-soft",
  all_fired: "sage-soft",
};

// The facilitator's "what should I fire next, and are we on pace?" card
// (Release 1). Recomputed every second from data the Command Center already
// polls, using the same rules the optional autopilot uses (lib/pacing.ts).
export function NextUpCard({
  clock,
  events,
  dispatches,
  chainStatus,
  targetHints,
  autopilotEnabled,
  showAutopilot,
}: {
  clock: GlobalClockFields;
  events: PacingEvent[];
  dispatches: PacingDispatch[];
  chainStatus: Record<string, { ok: boolean; blockedBy: string[] }>;
  targetHints?: Record<string, string[]>;
  autopilotEnabled: boolean;
  showAutopilot: boolean;
}) {
  const qc = useQueryClient();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fire = useMutation({
    mutationFn: (rec: Recommendation) =>
      apiFetch("/api/events", { method: "POST", body: JSON.stringify({ eventId: rec.eventId, targetRegionIds: rec.targetRegions ?? [] }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
  const toggleAutopilot = useMutation({
    mutationFn: (enabled: boolean) => apiFetch("/api/instructor/autopilot", { method: "PATCH", body: JSON.stringify({ enabled }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
  });

  const p = computePacing({ events, dispatches, chainStatus, targetHints, clock, now });
  const statusText =
    p.status === "behind"
      ? `Behind ~${Math.round(p.minutesOffSchedule)} min`
      : p.status === "ahead"
        ? "Ahead of schedule"
        : STATUS_LABEL[p.status];

  return (
    <section className="rounded-lg bg-surface p-5" aria-labelledby="next-up-heading">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="next-up-heading" className="text-sm font-bold text-text">
          Next up
        </h2>
        <Chip tone={STATUS_TONE[p.status]}>{statusText}</Chip>
        <span className="text-xs text-neutral-700">
          Act {p.currentAct} of 5 · {p.requiredRemaining} required event{p.requiredRemaining === 1 ? "" : "s"} left
          {p.status !== "not_started" && ` · ~${Math.round(p.minutesRemaining)} min of story left`}
        </span>
        {showAutopilot && (
          <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-neutral-800">
            <input
              type="checkbox"
              checked={autopilotEnabled}
              onChange={(ev) => toggleAutopilot.mutate(ev.target.checked)}
              disabled={toggleAutopilot.isPending}
            />
            Autopilot (fires required events on schedule)
          </label>
        )}
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-300" aria-hidden="true">
        <div className="h-full bg-accent-2-600" style={{ width: `${p.storyProgressPct}%` }} />
      </div>

      {p.next ? (
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-md bg-bg p-4">
          <div className="min-w-0">
            <p className="font-semibold text-text">
              {p.next.title} <span className="text-xs font-normal text-neutral-700">({p.next.eventId})</span>
            </p>
            <p className="mt-1 text-sm text-neutral-800">{p.next.reason}</p>
            <p className="mt-1 text-xs text-neutral-700">
              Goes to: {p.next.targetRegions ? p.next.targetRegions.join(", ") : "all regions"} ·{" "}
              <a href={`#event-${p.next.eventId}`} className="font-medium text-accent-700 hover:text-accent-600">
                change audience in the queue
              </a>
            </p>
          </div>
          <PillButton tone="sage" size="sm" onClick={() => fire.mutate(p.next!)} disabled={fire.isPending || p.status === "not_started"}>
            Fire now
          </PillButton>
        </div>
      ) : (
        <p className="mt-4 text-sm text-neutral-700">
          {p.requiredRemaining === 0 ? "Every required event has been fired." : "No required event can fire yet."}
        </p>
      )}

      {p.blockedNote && (
        <p className="mt-3 text-sm text-accent-800">
          {p.blockedNote}{" "}
          {p.blockedNote.includes("score") && (
            <Link href="/scoring" className="font-medium text-accent-700 underline hover:text-accent-600">
              Go to scoring
            </Link>
          )}
        </p>
      )}

      {p.tips.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-neutral-800">
          {p.tips.map((t) => (
            <li key={t}>• {t}</li>
          ))}
        </ul>
      )}

      {p.optional.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-neutral-700">Optional, if you have room</p>
          <div className="space-y-2">
            {p.optional.map((o) => (
              <div key={o.eventId} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-bg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-text">
                    {o.title} <span className="text-xs text-neutral-700">({o.eventId})</span>
                  </p>
                  <p className="text-xs text-neutral-700">{o.reason}</p>
                </div>
                <PillButton tone="ghost" size="sm" onClick={() => fire.mutate(o)} disabled={fire.isPending}>
                  Fire
                </PillButton>
              </div>
            ))}
          </div>
        </div>
      )}

      {fire.error && <p className="mt-2 text-sm text-accent-700">{(fire.error as Error).message}</p>}
    </section>
  );
}
