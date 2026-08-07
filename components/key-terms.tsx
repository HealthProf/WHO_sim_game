import { getRelevantGlossaryTerms } from "@/lib/glossary";

// Auto-detected (not hand-annotated) subset of the glossary relevant to a
// given event's narrative/prompt text — see lib/glossary.ts. Shows nothing
// if no known term matches, rather than an empty box.
export function KeyTerms({ texts }: { texts: string[] }) {
  const terms = getRelevantGlossaryTerms(...texts);
  if (terms.length === 0) return null;

  return (
    <section className="rounded-lg bg-surface p-4">
      <p className="mb-2 text-xs uppercase tracking-wide text-neutral-600">Key Terms</p>
      <dl className="space-y-2 text-sm">
        {terms.map((t) => (
          <div key={t.id}>
            <dt className="inline font-medium text-text">{t.term}:</dt>{" "}
            <dd className="inline text-neutral-700">{t.definition}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
