import { glossaryTerms, type GlossaryTerm } from "./db/seed-data/glossary";

// Scans free text for glossary term matches (case-insensitive substring)
// instead of requiring every event to be hand-annotated with a term list —
// keeps the "Key Terms" callout automatically in sync with narrative copy
// as events are edited. Returns terms in glossary declaration order (their
// most natural reading order), deduplicated.
export function getRelevantGlossaryTerms(...texts: string[]): GlossaryTerm[] {
  const combined = texts.join(" \n ").toLowerCase();
  return glossaryTerms.filter((t) => t.matchPatterns.some((p) => combined.includes(p.toLowerCase())));
}
