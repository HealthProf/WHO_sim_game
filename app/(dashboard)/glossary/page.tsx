import { glossaryTerms } from "@/lib/db/seed-data/glossary";

export default function GlossaryPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Reference</p>
        <h1 className="text-2xl font-semibold">Glossary</h1>
        <p className="text-sm text-slate-400 mt-2">
          Plain-language explanations of every acronym and technical term used in this simulation. You&apos;ll also
          see a smaller &quot;Key Terms&quot; box on each event page showing just the handful of terms relevant to
          that specific decision.
        </p>
      </div>
      <div className="space-y-3">
        {glossaryTerms.map((t) => (
          <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
            <p className="font-medium text-slate-100">{t.term}</p>
            <p className="text-sm text-slate-300 mt-1">{t.definition}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
