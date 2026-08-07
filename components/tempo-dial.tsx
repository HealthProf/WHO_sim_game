"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

const NOTCHES = [
  { value: 0.5, label: "Calm" },
  { value: 0.75, label: "Steady" },
  { value: 1.0, label: "Baseline" },
  { value: 1.5, label: "Tense" },
  { value: 2.0, label: "Crisis" },
];

// Item 9's "drama dial" — one control instead of three. See the schema
// comment on globalState.intensityMultiplier for exactly what it scales
// (passive Rt drift, WHO HQ price escalation, deadline window length).
export function TempoDial({ intensityMultiplier }: { intensityMultiplier: number }) {
  const qc = useQueryClient();
  const setTempo = useMutation({
    mutationFn: (value: number) => apiFetch("/api/instructor/tempo", { method: "PATCH", body: JSON.stringify({ intensityMultiplier: value }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
  });

  // The five notches only cover the normal 0.5x-2.0x range the PATCH route
  // clamps manual adjustments to (see MIN/MAX_INTENSITY_MULTIPLIER in
  // lib/config.ts) — but the God Mode cheat code writes 5x directly to the
  // database, bypassing that clamp entirely, so the actual value can land
  // well outside every notch. Without this, an off-dial value highlighted
  // nothing at all, silently looking identical to "nothing happened."
  const matchedNotch = NOTCHES.some((n) => Math.abs(intensityMultiplier - n.value) < 0.01);

  return (
    <section className="rounded-lg bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-text">Tempo</h2>
        <span className="text-xs text-neutral-700">Scales Rt drift, WHO HQ prices, and deadline windows together</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-full bg-neutral-200 p-[5px]">
        {NOTCHES.map((n) => {
          const isActive = Math.abs(intensityMultiplier - n.value) < 0.01;
          return (
            <button
              key={n.value}
              onClick={() => setTempo.mutate(n.value)}
              disabled={setTempo.isPending}
              className={`flex-1 rounded-full px-2 py-2 text-xs font-medium transition-colors duration-150 ${
                isActive ? "bg-accent-700 text-white" : "text-neutral-700 hover:text-text"
              }`}
            >
              <p>{n.label}</p>
              <p className="text-[10px] opacity-75">{n.value.toFixed(2)}x</p>
            </button>
          );
        })}
      </div>
      {!matchedNotch && (
        <p className="mt-2 text-xs font-medium text-accent-700">
          Currently {intensityMultiplier.toFixed(2)}x — outside the normal range. Pick a notch above to reset it.
        </p>
      )}
    </section>
  );
}
