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
    <section className="rounded-lg bg-surface p-4">
      <p className="mb-1 text-xs uppercase tracking-wide text-neutral-600">Advisory Board Perspectives</p>
      <p className="mb-3 text-xs text-neutral-600">
        Real advisors disagree. These are not a recommendation — weigh them against the evidence yourself.
      </p>
      <div className="space-y-3">
        {opinions.map((o, i) => (
          <div key={i} className="border-l-2 border-divider pl-3">
            <p className="text-xs font-semibold text-text">{o.role}</p>
            <p className="mt-0.5 text-sm text-neutral-700">{o.opinion}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
