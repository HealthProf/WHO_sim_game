"use client";

import { useEffect } from "react";
import type { CurrentScenarioSlide } from "@/lib/use-scenario-overview";

// Update 3's slide requirements, verbatim: white text on a solid black
// background, full screen, one slide's worth of copy at a time, no next/
// back/skip controls of any kind — auto-advance only, driven entirely by
// the parent's useCurrentScenarioSlide(startedAt) clock. This component has
// no state and no timers of its own; it just renders whatever slide it's
// handed.
export function ScenarioOverviewOverlay({ slide }: { slide: CurrentScenarioSlide }) {
  // Lock body scroll while the takeover is showing — same reasoning as any
  // full-screen modal: nothing behind it should be scrollable or reachable.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scenario overview"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black px-8 text-white"
    >
      <p aria-live="polite" className="max-w-3xl text-center text-[26px] leading-[1.5] font-medium sm:text-[32px]">
        {slide.body}
      </p>
    </div>
  );
}
