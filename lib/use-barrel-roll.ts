"use client";

import { useEffect, useRef } from "react";

// Cheat code #3: "the entire game screen for everyone does a complete 360
// degree roll." barrelRollAt is a session-wide broadcast timestamp (see
// lib/cheat-engine.ts) — every poller (dashboard, instructor console,
// projector) that observes it change plays the roll once on <html> itself,
// so it really is the whole screen, not just one panel. The first value a
// component ever sees (on mount) is treated as a baseline, not a trigger —
// otherwise loading the page shortly after someone else's roll would
// immediately replay it.
const BARREL_ROLL_DURATION_MS = 1400;

export function useBarrelRollEffect(barrelRollAt: string | null | undefined) {
  const seenRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    const next = barrelRollAt ?? null;
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
