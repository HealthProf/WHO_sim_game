"use client";

import { useEffect, useState } from "react";
import { SCENARIO_OVERVIEW_SLIDES, SCENARIO_OVERVIEW_SLIDE_STARTS, SCENARIO_OVERVIEW_TOTAL_SECONDS } from "./db/seed-data/scenario-overview-slides";

export interface CurrentScenarioSlide {
  index: number;
  total: number;
  body: string;
}

// Pure index math, pulled out of the hook below so it's unit-testable
// without a React/DOM environment (this project's Vitest config runs in
// plain Node — see tests/scenario-overview.test.ts) — same reasoning as
// lib/cheat-engine.ts's computeRevertOverride.
//
// Returns null once the deck has finished (elapsed past the last slide) so
// callers can treat "no longer null -> null" as the one-shot "sequence just
// ended" transition (see components/scenario-overview-watcher.tsx).
export function computeCurrentSlideIndex(elapsedSec: number): number | null {
  // The deck is finished once real elapsed time passes every slide's
  // duration — not `index >= total`, since the last slide's duration can
  // differ from the others (see SCENARIO_OVERVIEW_SLIDE_STARTS).
  if (elapsedSec >= SCENARIO_OVERVIEW_TOTAL_SECONDS) return null;

  // A negative elapsedSec means this client discovered the deck before its
  // official start instant (server sets startedAt a few seconds in the
  // future — see SCENARIO_OVERVIEW_PREROLL_SECONDS in lib/config.ts) — show
  // slide 1 immediately rather than nothing, so a well-connected client
  // never sees a blank screen while other clients are still catching up.
  // Slide 1's real countdown only starts at elapsedSec 0, so this doesn't
  // shrink its window for anyone.
  if (elapsedSec < 0) return 0;

  // Last slide whose start offset has already passed.
  let index = 0;
  for (let i = 0; i < SCENARIO_OVERVIEW_SLIDE_STARTS.length; i++) {
    if (elapsedSec >= SCENARIO_OVERVIEW_SLIDE_STARTS[i]) index = i;
    else break;
  }
  return index;
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
export function useCurrentScenarioSlide(startedAt: string | null | undefined): CurrentScenarioSlide | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return null;

  const elapsedSec = (now - new Date(startedAt).getTime()) / 1000;
  const index = computeCurrentSlideIndex(elapsedSec);
  if (index === null) return null;

  return { index, total: SCENARIO_OVERVIEW_SLIDES.length, body: SCENARIO_OVERVIEW_SLIDES[index].body };
}
