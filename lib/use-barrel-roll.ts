"use client";

import { useEffect, useRef } from "react";

// Cheat code #3: "the entire game screen for everyone does a complete 360
// degree roll." barrelRollAt is a session-wide broadcast timestamp (see
// lib/cheat-engine.ts) — every poller (dashboard, instructor console,
// projector) that observes it change plays the roll once on <html> itself,
// so it really is the whole screen, not just one panel. The first value a
// component ever sees is treated as a baseline, not a trigger — otherwise
// loading the page shortly after someone else's roll would immediately
// replay it.
//
// The baseline must come from the first *resolved* value, not the first
// effect run: callers pass `undefined` while their query is still loading
// (e.g. react-query before its first response), and that undefined render
// still runs this effect. Treating that as the baseline meant the real
// first value — the query's actual initial payload, whether or not a roll
// was in progress — always looked like a fresh "no roll -> timestamp"
// change and fired the roll on ordinary page load, every time. Waiting for
// a defined value before capturing the baseline fixes that; a client that
// happens to load *during* the broadcast window still correctly rolls once.
const BARREL_ROLL_DURATION_MS = 1400;

export function useBarrelRollEffect(barrelRollAt: string | null | undefined) {
  const seenRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (barrelRollAt === undefined) return;
    const next = barrelRollAt;
    if (!initializedRef.current) {
      initializedRef.current = true;
      seenRef.current = next;
      return;
    }
    if (next === seenRef.current) return;
    seenRef.current = next;
    if (!next) return;

    document.documentElement.classList.add("animate-barrel-roll");
    const timeoutId = setTimeout(() => {
      document.documentElement.classList.remove("animate-barrel-roll");
    }, BARREL_ROLL_DURATION_MS);
    return () => clearTimeout(timeoutId);
  }, [barrelRollAt]);
}
