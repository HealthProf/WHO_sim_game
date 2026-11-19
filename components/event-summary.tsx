import { eventSummaries } from "@/lib/db/seed-data/event-summaries";
import { advisoryOpinions } from "@/lib/db/seed-data/advisory-opinions";
import { expectedRange } from "@/lib/outcome-variance";
import { FIELD_LABEL, formatEffect, isGood, splitByAudience } from "@/lib/effect-labels";
import type { ModelDelta, OptionCost, Tier } from "@/lib/db/seed-data/events";

export interface SummaryOption {
  label: string;
  text: string;
  cost?: OptionCost;
  suggestedTier?: Tier;
}

// "The short version" at the top of an event (Release 2 playtest request):
// what's happening in a sentence or two, each advisor's stance in one line,
// and what each choice is expected to do to *your* region and to the world,
// so a team juggling several events can triage quickly.
//
// Expected effects come from the event's designed model deltas for the tier
// that option is built as, shown as a range because the realized outcome
// varies (lib/outcome-variance.ts). They assume the choice is graded at its
// usual level; a thin rationale can lower the grade, and a lower grade has
// different effects. The facilitator can hide this section entirely.
export function EventSummary({
  eventId,
  options,
  modelDeltaJson,
  ownRegionId,
  showExpectedEffects,
}: {
  eventId: string;
  options: SummaryOption[] | null;
  modelDeltaJson: Record<string, ModelDelta[]> | null;
  ownRegionId: string | null | undefined;
  showExpectedEffects: boolean;
}) {
  const summary = eventSummaries[eventId];
  const advisors = advisoryOpinions[eventId] ?? [];
  if (!summary && advisors.length === 0) return null;

  return (
    <section className="rounded-lg border-2 border-accent-300 bg-bg p-4 text-sm text-neutral-800" aria-labelledby="short-version">
      <p id="short-version" className="text-[11px] font-bold uppercase tracking-wide text-accent-700">
        The short version
      </p>
      {summary && <p className="mt-1 text-[15px] leading-snug text-text">{summary}</p>}

      {advisors.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-text">Advisor stances</p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {advisors.map((a) => (
              <li key={a.role}>
                <span className="font-semibold">{a.role}:</span> {firstSentence(a.opinion)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showExpectedEffects && options && options.length > 0 && modelDeltaJson && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-text">What each choice is expected to do</p>
          <div className="mt-1 space-y-2">
            {options.map((o) => {
              const deltas = o.suggestedTier ? (modelDeltaJson[o.suggestedTier] ?? []) : [];
              const { mine, world } = splitByAudience(deltas, ownRegionId);
              return (
                <div key={o.label} className="rounded-md bg-surface px-3 py-2 text-xs">
                  <p className="font-semibold text-text">
                    {o.label}. <span className="font-normal">{truncate(o.text, 90)}</span>
                  </p>
                  <p className="mt-0.5">
                    <span className="text-neutral-700">Cost: </span>
                    {costText(o.cost)}
                  </p>
                  <EffectLine label="Your region" deltas={mine} />
                  {world.length > 0 && <EffectLine label="Elsewhere" deltas={world} withWhere />}
                </div>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-700">
            Ranges, not promises: real outcomes vary. Assumes your choice is graded at its usual level; a weak rationale can lower
            the grade and change the effect.
          </p>
        </div>
      )}
    </section>
  );
}

function EffectLine({ label, deltas, withWhere = false }: { label: string; deltas: (ModelDelta & { where?: string })[]; withWhere?: boolean }) {
  return (
    <p className="mt-0.5">
      <span className="text-neutral-700">{label}: </span>
      {deltas.length === 0
        ? "no modeled change"
        : deltas.map((d, i) => {
            const [lo, hi] = expectedRange(d);
            const good = isGood(d.field, d.delta);
            return (
              <span key={i}>
                {i > 0 && " · "}
                {withWhere && d.where ? `${d.where} ` : ""}
                {FIELD_LABEL[d.field]}{" "}
                <span className={good ? "font-semibold text-accent-2-800" : "font-semibold text-accent-800"}>
                  {formatEffect(d.field, lo, hi)} ({good ? "better" : "worse"})
                </span>
              </span>
            );
          })}
    </p>
  );
}

function costText(cost?: OptionCost): string {
  if (!cost) return "none";
  const parts: string[] = [];
  if (cost.fund) parts.push(`$${(cost.fund / 1_000_000).toFixed(1)}M`);
  if (cost.ppeDays) parts.push(`${cost.ppeDays} PPE days`);
  if (cost.antivirals) parts.push(`${cost.antivirals.toLocaleString()} antivirals`);
  return parts.length ? parts.join(", ") : "none";
}

function firstSentence(text: string): string {
  const m = text.match(/^.*?[.!?](?=\s|$)/);
  return m ? m[0] : text;
}

function truncate(text: string, n: number): string {
  return text.length > n ? `${text.slice(0, n - 1).trimEnd()}…` : text;
}
