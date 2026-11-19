import { pathogenFor } from "@/lib/pathogens";

// What this game's outbreak is (Release 5): name, agent, key facts, and an
// honest note when the pathogen is a hypothetical variant. Facilitators also
// see the sources behind the parameters.
export function PathogenCard({ pathogenId, showSources = false, compact = false }: { pathogenId: string | null | undefined; showSources?: boolean; compact?: boolean }) {
  const p = pathogenFor(pathogenId);
  return (
    <section className="rounded-lg bg-surface p-4 text-sm text-neutral-800" aria-labelledby="pathogen-heading">
      <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-700">This outbreak</p>
      <h2 id="pathogen-heading" className="font-heading text-[20px] leading-tight text-text">
        {p.codeName} <span className="text-[15px] font-normal text-neutral-700">· {p.name}</span>
      </h2>
      <p className="mt-0.5 text-xs text-neutral-700">
        {p.agent}. {p.transmission}.
      </p>
      {!compact && (
        <dl className="mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {p.facts.map((f) => (
            <div key={f.label}>
              <dt className="inline font-semibold text-text">{f.label}: </dt>
              <dd className="inline">{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {p.hypotheticalNote && <p className="mt-2 rounded-md bg-bg px-2.5 py-1.5 text-xs text-neutral-800">{p.hypotheticalNote}</p>}
      {showSources && <p className="mt-2 text-[11px] text-neutral-700">Sources: {p.sources.join("; ")}.</p>}
    </section>
  );
}
