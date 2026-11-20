"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { TierChip } from "@/components/ui/chip";
import { FIELD_LABEL, formatEffect, isGood, splitByAudience } from "@/lib/effect-labels";
import type { ModelDelta } from "@/lib/db/seed-data/events";

interface ResultData {
  status: string;
  structuredChoice: string | null;
  autoFallback: boolean;
  tier: string | null;
  appliedDeltas: ModelDelta[] | null;
}

// "How did that land?" on a scored event (Release 2 playtest request). By
// default each team decides whether to look (toggle starts off). When the
// facilitator turns on "always show results", it's shown to everyone with no
// toggle.
export function EventResult({ dispatchId, ownRegionId, forced }: { dispatchId: number; ownRegionId: string | null | undefined; forced: boolean }) {
  const [show, setShow] = useState(false);
  const visible = forced || show;
  const { data } = useQuery({
    queryKey: ["decision-result", dispatchId],
    queryFn: () => apiFetch<ResultData>(`/api/decisions/result?eventDispatchId=${dispatchId}`),
  });
  if (!data || !data.tier) return null;

  const { mine, world } = splitByAudience(data.appliedDeltas ?? [], ownRegionId);

  return (
    <section className="rounded-lg bg-surface p-4 text-sm text-neutral-800" aria-labelledby="result-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id="result-heading" className="font-semibold text-text">
          Result
        </p>
        {!forced && (
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
            Show how this affected us and the world
          </label>
        )}
      </div>
      {visible && (
        <div className="mt-2 space-y-1.5">
          <p className="flex flex-wrap items-center gap-2">
            {data.autoFallback ? "No response was submitted in time; the default consequence applied." : `You chose ${data.structuredChoice ?? "a written response"}.`}{" "}
            Graded <TierChip tier={data.tier} />
          </p>
          <EffectList label="Your region" deltas={mine} />
          {world.length > 0 && <EffectList label="Elsewhere" deltas={world} />}
          <p className="text-[11px] text-neutral-700">These are the actual effects after real-world variation, not the expected ranges.</p>
        </div>
      )}
    </section>
  );
}

function EffectList({ label, deltas }: { label: string; deltas: (ModelDelta & { where?: string })[] }) {
  return (
    <p className="text-xs">
      <span className="text-neutral-700">{label}: </span>
      {deltas.length === 0
        ? "no modeled change"
        : deltas.map((d, i) => {
            const good = isGood(d.field, d.delta);
            return (
              <span key={i}>
                {i > 0 && " · "}
                {d.where ? `${d.where} ` : ""}
                {FIELD_LABEL[d.field]}{" "}
                <span className={good ? "font-semibold text-accent-2-800" : "font-semibold text-accent-800"}>
                  {formatEffect(d.field, d.delta, d.delta)} ({good ? "better" : "worse"})
                </span>
              </span>
            );
          })}
    </p>
  );
}
