"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { PillButton } from "@/components/ui/pill-button";
import { projectedMinutesRemaining } from "@/lib/game-duration";
import { decisionWindowMinutes } from "@/lib/decision-window";
import type { GlobalClockFields } from "@/lib/sim-clock";

export interface PacingGlobalState extends GlobalClockFields {
  targetDurationMinutes: number;
  decisionTimeMultiplier: number;
  decisionWindowBaseMinutes: number;
  fastModeMultiplier: number;
}

const DURATION_PRESETS = [45, 60, 75, 90, 120];

// Release 1 pacing controls: total game duration and decision time. They're
// independent of each other and of the Tempo dial:
// - Duration paces the story (how fast the in-game days pass).
// - Decision time sets how long each event stays open, and moving it
//   rescales the time left on events that are open right now.
export function PacingPanel({ state, openEventCount }: { state: PacingGlobalState; openEventCount: number }) {
  const qc = useQueryClient();
  const [customMinutes, setCustomMinutes] = useState("");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(interval);
  }, []);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["events"] });
  };

  const setDuration = useMutation({
    mutationFn: (minutes: number) => apiFetch("/api/instructor/duration", { method: "PATCH", body: JSON.stringify({ minutes }) }),
    onSuccess: () => {
      setCustomMinutes("");
      invalidate();
    },
  });
  const setDecisionTime = useMutation({
    mutationFn: (multiplier: number) => apiFetch("/api/instructor/decision-time", { method: "PATCH", body: JSON.stringify({ multiplier }) }),
    onSuccess: invalidate,
  });
  const extendOpen = useMutation({
    mutationFn: () => apiFetch("/api/instructor/decision-time", { method: "POST" }),
    onSuccess: invalidate,
  });

  // The slider keeps a local value while dragging and commits once the
  // facilitator stops moving it, so one drag is one server write (and one
  // rescale of open events), not dozens.
  const [draftMultiplier, setDraftMultiplier] = useState(state.decisionTimeMultiplier);
  const [dragging, setDragging] = useState(false);
  const shownMultiplier = dragging ? draftMultiplier : state.decisionTimeMultiplier;
  function commitMultiplier() {
    setDragging(false);
    if (Math.abs(draftMultiplier - state.decisionTimeMultiplier) > 0.001) setDecisionTime.mutate(draftMultiplier);
  }

  const started = !!state.simulationStartedAt;
  const remaining = projectedMinutesRemaining(state, now);
  const exampleWindow = (hours: number) =>
    Math.round(decisionWindowMinutes(hours, { ...state, decisionTimeMultiplier: shownMultiplier }));

  return (
    <section className="rounded-lg bg-surface p-5">
      <h2 className="mb-4 text-sm font-bold text-text">Pacing</h2>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Duration */}
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-neutral-700">Game duration (play time)</p>
            <p className="text-xs text-neutral-700">
              {started ? `Story ends in ~${Math.round(remaining)} min` : `Set to ${state.targetDurationMinutes} min`}
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {DURATION_PRESETS.map((m) => {
              const active = m === state.targetDurationMinutes;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDuration.mutate(m)}
                  disabled={setDuration.isPending}
                  aria-pressed={active}
                  className={
                    active
                      ? "rounded-full bg-accent-700 px-3.5 py-1.5 text-xs font-bold text-white"
                      : "rounded-full bg-bg px-3.5 py-1.5 text-xs text-neutral-800 hover:bg-neutral-200"
                  }
                >
                  {m} min
                </button>
              );
            })}
            <form
              className="flex items-center gap-1.5"
              onSubmit={(ev) => {
                ev.preventDefault();
                const n = Number(customMinutes);
                if (Number.isFinite(n) && n > 0) setDuration.mutate(n);
              }}
            >
              <label className="sr-only" htmlFor="custom-duration">
                Custom duration in minutes
              </label>
              <input
                id="custom-duration"
                type="number"
                inputMode="numeric"
                min={20}
                max={180}
                placeholder="Custom"
                value={customMinutes}
                onChange={(ev) => setCustomMinutes(ev.target.value)}
                className="w-24 rounded-full border-2 border-divider bg-bg px-3 py-1 text-xs"
              />
              {customMinutes && (
                <PillButton size="sm" tone="ghost" type="submit" disabled={setDuration.isPending}>
                  Set
                </PillButton>
              )}
            </form>
          </div>
          <p className="mt-2 text-xs text-neutral-700">
            {started
              ? "Changing it now keeps the current in-game day and re-paces only what's left."
              : "Briefing and debrief are not included. You can change this during the game."}
          </p>
        </div>

        {/* Decision time */}
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor="decision-time" className="text-xs uppercase tracking-wide text-neutral-700">
              Decision time
            </label>
            <span className="text-xs font-bold text-text">{shownMultiplier.toFixed(2)}x</span>
          </div>
          <input
            id="decision-time"
            type="range"
            min={0.5}
            max={2}
            step={0.25}
            value={shownMultiplier}
            onChange={(ev) => {
              setDragging(true);
              setDraftMultiplier(Number(ev.target.value));
            }}
            onPointerUp={commitMultiplier}
            onKeyUp={commitMultiplier}
            onBlur={() => dragging && commitMultiplier()}
            className="mt-2 w-full accent-[var(--color-accent-700)]"
            aria-describedby="decision-time-help"
          />
          <div className="flex justify-between text-[11px] text-neutral-700">
            <span>Shorter</span>
            <span>Longer</span>
          </div>
          <p id="decision-time-help" className="mt-1 text-xs text-neutral-700">
            Events get {exampleWindow(2)} to {exampleWindow(6)} minutes each at this setting. Changing it also rescales events open right now.
          </p>
          <div className="mt-2">
            <PillButton size="sm" tone="ghost" onClick={() => extendOpen.mutate()} disabled={openEventCount === 0 || extendOpen.isPending}>
              +2 min to all open events{openEventCount > 0 ? ` (${openEventCount})` : ""}
            </PillButton>
          </div>
        </div>
      </div>
    </section>
  );
}
