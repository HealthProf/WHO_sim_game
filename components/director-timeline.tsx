"use client";

import { useEffect, useState } from "react";
import { computeSimClock, type GlobalClockFields } from "@/lib/sim-clock";
import { mapNarrativeDayToGameDay } from "@/lib/game-day";

interface EventLite {
  id: string;
  day: number;
  isCorePath: boolean;
  title: string;
}

interface DispatchLite {
  eventId: string;
  status: string;
}

// Item 8's "director's timeline" — the Event Queue is a list, but a
// facilitator running a live session thinks in acts and pacing, not rows.
// This answers "what act are we in, and are we behind?" at a glance,
// computed entirely from data the Control page already has (no extra
// fetch): the five narrative days (03-events.md's Monday-Friday structure)
// mapped onto the compressed game-day scale, each act's core-path events,
// and how many have actually been dispatched/scored so far.
export function DirectorTimeline({ state, events, dispatches }: { state: GlobalClockFields; events: EventLite[]; dispatches: DispatchLite[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const clock = computeSimClock(state, now);
  const totalGameDays = state.totalGameDays || 90;

  const acts = [1, 2, 3, 4, 5].map((narrativeDay) => {
    const gameDayStart = mapNarrativeDayToGameDay(narrativeDay, totalGameDays);
    const coreEvents = events.filter((e) => e.isCorePath && e.day === narrativeDay);
    const dispatchedCount = coreEvents.filter((e) => dispatches.some((d) => d.eventId === e.id)).length;
    const scoredCount = coreEvents.filter((e) => dispatches.some((d) => d.eventId === e.id && (d.status === "scored" || d.status === "closed"))).length;
    return { narrativeDay, gameDayStart, totalCore: coreEvents.length, dispatchedCount, scoredCount };
  });

  let currentActIndex = 0;
  for (let i = 0; i < acts.length; i++) {
    if (clock.gameDay >= acts[i].gameDayStart) currentActIndex = i;
  }
  const behindActs = acts.slice(0, currentActIndex).filter((a) => a.totalCore > 0 && a.dispatchedCount < a.totalCore);
  const progressPct = Math.min(100, (clock.gameDay / totalGameDays) * 100);

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-200">Session Timeline</h2>
        {behindActs.length > 0 ? (
          <span className="text-xs font-semibold text-amber-400">
            Behind on Act {behindActs.map((a) => a.narrativeDay).join(", ")} — {behindActs.reduce((s, a) => s + (a.totalCore - a.dispatchedCount), 0)} core event(s) not yet dispatched
          </span>
        ) : (
          <span className="text-xs font-semibold text-emerald-400">On track</span>
        )}
      </div>

      <div className="relative h-2 bg-slate-800 rounded-full mb-3">
        <div className="absolute inset-y-0 left-0 bg-blue-600 rounded-full" style={{ width: `${progressPct}%` }} />
        {acts.map((a, i) => (
          <div key={a.narrativeDay} className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${(a.gameDayStart / totalGameDays) * 100}%` }}>
            <div className={`w-3 h-3 rounded-full border-2 ${i <= currentActIndex ? "bg-blue-500 border-blue-300" : "bg-slate-700 border-slate-600"}`} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-2 text-xs">
        {acts.map((a, i) => (
          <div key={a.narrativeDay} className={`rounded-lg p-2 ${i === currentActIndex ? "bg-blue-950/60 border border-blue-800" : "bg-slate-800/40"}`}>
            <p className="text-slate-400">Act {a.narrativeDay}</p>
            <p className="font-semibold text-slate-100">{a.dispatchedCount}/{a.totalCore} dispatched</p>
            <p className="text-slate-500">{a.scoredCount}/{a.totalCore} scored</p>
          </div>
        ))}
      </div>
    </section>
  );
}
