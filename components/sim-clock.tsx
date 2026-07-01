"use client";

import { useEffect, useState } from "react";
import { computeSimClock, formatRealElapsed, formatSimClock, type GlobalClockFields } from "@/lib/sim-clock";

// Ticks every second locally (no network calls) using whatever GlobalState
// fields were last fetched from the server, so the clock stays smooth
// between polls instead of jumping every 10-15s. Both the in-game clock and
// the real elapsed clock derive from the same `now` tick, so they always
// move together.
export function SimClock({ state, size = "md" }: { state: GlobalClockFields; size?: "md" | "lg" }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const clock = computeSimClock(state, now);

  const labelClass = size === "lg" ? "text-lg" : "text-xs";
  const valueClass = size === "lg" ? "text-4xl" : "text-base";

  return (
    <div className="flex items-center gap-6">
      <div>
        <p className={`${labelClass} text-slate-400 uppercase tracking-wide`}>In-Game Time</p>
        <p className={`${valueClass} font-semibold tabular-nums`}>{formatSimClock(clock)}</p>
      </div>
      <div>
        <p className={`${labelClass} text-slate-400 uppercase tracking-wide`}>Real Elapsed</p>
        <p className={`${valueClass} font-semibold tabular-nums`}>
          {clock.running ? formatRealElapsed(clock.realElapsedMs) : `${formatRealElapsed(clock.realElapsedMs)} (paused)`}
        </p>
      </div>
    </div>
  );
}
