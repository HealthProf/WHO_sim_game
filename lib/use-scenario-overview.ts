"use client";

import { useEffect, useState } from "react";
import { SCENARIO_OVERVIEW_SLIDES, SCENARIO_SLIDE_SECONDS } from "./db/seed-data/scenario-overview-slides";

export interface CurrentScenarioSlide {
  index: number;
  total: number;
  body: string;
}

// Same shared-clock pattern as the cheat monologue (lib/use-monologue.ts,
// see its header comment for why): the server publishes one `startedAt`
// timestamp and every client ticks its own local clock every second,
// deriving the current slide from elapsed real time rather than from
// whatever slide happened to be "current" at the moment of the last poll.
// This is what makes every connected screen show the same slide at the same
// moment regardless of when each one discovered `startedAt` — a late joiner
// computes the same index everyone else already has, instead of restarting
// the deck from slide 1.
//
// Returns null once the deck has finished (elapsed past the last slide) so
// callers can treat "no longer null -> null" as the one-shot "sequence just
// ended" transition (see components/scenario-overview-watcher.tsx).
export function useCurrentScenarioSlide(startedAt: string | null | undefined): CurrentScenarioSlide | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return null;

  const elapsedSec = (now - new Date(startedAt).getTime()) / 1000;
  const total = SCENARIO_OVERVIEW_SLIDES.length;
  const index = Math.floor(elapsedSec / SCENARIO_SLIDE_SECONDS);
  if (index < 0 || index >= total) return null;

  return { index, total, body: SCENARIO_OVERVIEW_SLIDES[index].body };
}
