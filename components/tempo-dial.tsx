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

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-200">Tempo</h2>
        <span className="text-xs text-slate-500">Scales Rt drift, WHO HQ prices, and deadline windows together</span>
      </div>
      <div className="flex items-center gap-2">
        {NOTCHES.map((n) => {
          const active = Math.abs(intensityMultiplier - n.value) < 0.01;
          return (
            <button
              key={n.value}
              onClick={() => setTempo.mutate(n.value)}
              disabled={setTempo.isPending}
              className={`flex-1 rounded-md px-2 py-2 text-xs font-medium transition-colors ${
                active ? "bg-orange-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              <p>{n.label}</p>
              <p className="text-[10px] opacity-75">{n.value.toFixed(2)}x</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
