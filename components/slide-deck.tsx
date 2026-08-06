"use client";

import { useEffect, useState } from "react";
import type { OrientationSlide } from "@/lib/db/seed-data/orientation-slides";

// Generic keyboard-navigable slide deck — used for both the projector-facing
// orientation deck and the instructor's pre-session checklist (see
// lib/db/seed-data/orientation-slides.ts). Renders bodyMarkdown as plain
// text/line-broken paragraphs rather than pulling in a markdown renderer —
// the placeholder copy is simple enough not to need one, and every other
// consumer of markdown-ish content in this app (e.g. narrativeMarkdown)
// already does the same lightweight rendering.
export function SlideDeck({ slides }: { slides: OrientationSlide[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") setIndex((i) => Math.min(i + 1, slides.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [slides.length]);

  if (slides.length === 0) return null;
  const slide = slides[index];

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl p-10 text-center">
        <h2 className="text-2xl font-semibold text-slate-100 mb-6">{slide.title}</h2>
        <div className="text-slate-300 text-base leading-relaxed whitespace-pre-line text-left">{slide.bodyMarkdown}</div>
      </div>

      <div className="flex items-center gap-4 mt-6">
        <button
          type="button"
          onClick={() => setIndex((i) => Math.max(i - 1, 0))}
          disabled={index === 0}
          className="rounded-md bg-slate-800 border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-40"
        >
          Back
        </button>
        <span className="text-sm text-slate-500">
          {index + 1} / {slides.length}
        </span>
        <button
          type="button"
          onClick={() => setIndex((i) => Math.min(i + 1, slides.length - 1))}
          disabled={index === slides.length - 1}
          className="rounded-md bg-blue-600 hover:bg-blue-500 px-4 py-2 text-sm text-white font-medium disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
