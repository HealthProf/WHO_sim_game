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
    <section className="rounded-lg bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold text-text">Session Timeline</h2>
        {behindActs.length > 0 ? (
          <span className="rounded-full bg-accent-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-700">
            Behind on Act {behindActs.map((a) => a.narrativeDay).join(", ")} — {behindActs.reduce((s, a) => s + (a.totalCore - a.dispatchedCount), 0)} core event(s) not yet dispatched
          </span>
        ) : (
          <span className="rounded-full bg-accent-2-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-2-800">On track</span>
        )}
      </div>

      <div className="relative mb-3 h-2.5 rounded-full bg-neutral-300">
        <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${progressPct}%` }} />
        {acts.map((a, i) => (
          <div key={a.narrativeDay} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${(a.gameDayStart / totalGameDays) * 100}%` }}>
            <div className={`h-3.5 w-3.5 rounded-full border-[3px] border-bg ${i <= currentActIndex ? "bg-accent-700" : "bg-neutral-400"}`} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
        {acts.map((a, i) => (
          <div key={a.narrativeDay} className={`rounded-md p-2 ${i === currentActIndex ? "border-2 border-accent bg-accent-100" : "bg-bg"}`}>
            <p className={i === currentActIndex ? "text-accent-700" : "text-neutral-700"}>Act {a.narrativeDay}</p>
            <p className={`font-bold ${i === currentActIndex ? "text-accent-900" : "text-text"}`}>{a.dispatchedCount}/{a.totalCore} dispatched</p>
            <p className="text-neutral-700">{a.scoredCount}/{a.totalCore} scored</p>
          </div>
        ))}
      </div>
    </section>
  );
}
