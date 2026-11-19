"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import { glossaryTerms, type GlossaryTerm } from "@/lib/db/seed-data/glossary";

// Inline glossary (Release 1): jargon in event text gets a dotted underline;
// hovering it on a laptop or tapping it on a phone opens a short definition.
// Tap works everywhere, so the same control serves touch and mouse. The
// "Key Terms" box on the event page remains as the scan-the-whole-page list.
//
// Matching is stricter than lib/glossary.ts's loose substring scan, because
// a wrong inline highlight is more distracting than a wrong list entry:
// - whole words only;
// - a pattern containing capitals (Rt, CFR, RED, Optimal) matches
//   case-sensitively, so "red" or "adequate" in ordinary prose isn't tagged;
//   all-lowercase phrases ("public trust") match case-insensitively;
// - only the first mention of each term in a block is marked.

interface Matcher {
  term: GlossaryTerm;
  pattern: string;
  caseSensitive: boolean;
}

const MATCHERS: Matcher[] = glossaryTerms
  .flatMap((term) => term.matchPatterns.map((pattern) => ({ term, pattern, caseSensitive: /[A-Z]/.test(pattern) })))
  // Longest first so "IHR Article 12" wins over "Article 12".
  .sort((a, b) => b.pattern.length - a.pattern.length);

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function findMatches(text: string): { start: number; end: number; term: GlossaryTerm }[] {
  const taken: { start: number; end: number; term: GlossaryTerm }[] = [];
  const seenTerms = new Set<string>();
  for (const m of MATCHERS) {
    if (seenTerms.has(m.term.id)) continue;
    const re = new RegExp(`(?<![A-Za-z0-9])${escape(m.pattern)}(?![A-Za-z0-9])`, m.caseSensitive ? "g" : "gi");
    let hit: RegExpExecArray | null;
    while ((hit = re.exec(text))) {
      const start = hit.index;
      const end = start + hit[0].length;
      if (taken.some((t) => start < t.end && end > t.start)) continue;
      taken.push({ start, end, term: m.term });
      seenTerms.add(m.term.id);
      break;
    }
  }
  return taken.sort((a, b) => a.start - b.start);
}

export function GlossaryText({ text, className }: { text: string; className?: string }) {
  const matches = findMatches(text);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.start > cursor) parts.push(<Fragment key={`t${cursor}`}>{text.slice(cursor, m.start)}</Fragment>);
    parts.push(<GlossaryTermButton key={`g${m.start}`} label={text.slice(m.start, m.end)} term={m.term} />);
    cursor = m.end;
  }
  if (cursor < text.length) parts.push(<Fragment key={`t${cursor}`}>{text.slice(cursor)}</Fragment>);
  return <p className={className}>{parts}</p>;
}

function GlossaryTermButton({ label, term }: { label: string; term: GlossaryTerm }) {
  // Two separate reasons to show: hovering with a mouse, or pinned by a
  // click/tap. Kept apart so a mouse click on an already-hover-open term
  // pins it instead of toggling it shut.
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hovered || pinned;
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setPinned(false);
      setHovered(false);
    };
    const onDown = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      className="relative inline"
      // Hover only for real mouse pointers; touch devices use the tap below.
      onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHovered(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setPinned((p) => !p)}
        className="cursor-help underline decoration-dotted decoration-2 underline-offset-[3px] decoration-accent-600 hover:text-accent-800"
      >
        {label}
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-full z-50 mt-1 block w-[min(20rem,80vw)] whitespace-normal rounded-md bg-neutral-900 p-3 text-left text-[13px] font-normal leading-snug text-neutral-100 shadow-lg"
        >
          <span className="mb-1 block font-bold text-white">{term.term}</span>
          {term.definition}
        </span>
      )}
    </span>
  );
}
