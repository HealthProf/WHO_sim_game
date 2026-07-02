import { advisoryOpinions } from "@/lib/db/seed-data/advisory-opinions";

// Diverse, sometimes-contradictory stakeholder perspectives shown alongside
// a decision — see lib/db/seed-data/advisory-opinions.ts for the design
// intent: these are NOT a hint toward the "correct" answer, several openly
// argue for options that would score poorly. Not every event has these
// (informational/administrative events don't).
export function AdvisoryBoard({ eventId }: { eventId: string }) {
  const opinions = advisoryOpinions[eventId];
  if (!opinions || opinions.length === 0) return null;

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">Advisory Board Perspectives</p>
      <p className="text-xs text-slate-500 mb-3">
        Real advisors disagree. These are not a recommendation — weigh them against the evidence yourself.
      </p>
      <div className="space-y-3">
        {opinions.map((o, i) => (
          <div key={i} className="border-l-2 border-slate-700 pl-3">
            <p className="text-xs font-semibold text-slate-300">{o.role}</p>
            <p className="text-sm text-slate-400 mt-0.5">{o.opinion}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
