import { getRelevantGlossaryTerms } from "@/lib/glossary";

// Auto-detected (not hand-annotated) subset of the glossary relevant to a
// given event's narrative/prompt text — see lib/glossary.ts. Shows nothing
// if no known term matches, rather than an empty box.
export function KeyTerms({ texts }: { texts: string[] }) {
  const terms = getRelevantGlossaryTerms(...texts);
  if (terms.length === 0) return null;

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Key Terms</p>
      <dl className="space-y-2 text-sm">
        {terms.map((t) => (
          <div key={t.id}>
            <dt className="font-medium text-slate-200 inline">{t.term}:</dt>{" "}
            <dd className="text-slate-400 inline">{t.definition}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
