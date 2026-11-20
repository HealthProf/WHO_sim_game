"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { PillButton } from "@/components/ui/pill-button";

interface ResearchData {
  fund: number;
  milestone: number;
  contributions: Record<string, number>;
  milestones: { level: number; fund: number; name: string; effect: string }[];
  product: string;
}

const money = (n: number) => `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;

// Shared R&D fund (Release 5): progress toward trial-phase milestones, who
// has contributed, and (for teams) a contribute form.
export function ResearchSection({ canContribute }: { canContribute: boolean }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const { data } = useQuery({ queryKey: ["research"], queryFn: () => apiFetch<ResearchData>("/api/research"), refetchInterval: 10000 });
  const contribute = useMutation({
    mutationFn: () => apiFetch("/api/research", { method: "POST", body: JSON.stringify({ amount: Math.round(Number(amount) * 1_000_000) }) }),
    onSuccess: () => {
      setAmount("");
      qc.invalidateQueries({ queryKey: ["research"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  if (!data) return null;
  const max = data.milestones.at(-1)?.fund ?? 1;
  const pct = Math.min(100, (data.fund / max) * 100);
  const contributors = Object.entries(data.contributions).sort((a, b) => b[1] - a[1]);

  return (
    <section className="space-y-3" aria-labelledby="research-heading">
      <h2 id="research-heading" className="scroll-mt-6 font-heading text-[26px] text-text">
        Shared R&amp;D fund
      </h2>
      <p className="text-sm text-neutral-800">
        Pool money with other regions to fund research on {data.product}. Each completed trial phase helps every region. Reaching
        the last phase early makes a countermeasure available sooner, but rushing approval can backfire on public trust.
      </p>
      <div className="rounded-lg bg-surface p-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-text">{money(data.fund)} pooled</span>
          <span className="text-neutral-700">Goal {money(max)}</span>
        </div>
        <div className="relative mt-2 h-3 rounded-full bg-neutral-300" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={data.fund} aria-label="Research funding">
          <div className="h-full rounded-full bg-accent-2-600" style={{ width: `${pct}%` }} />
          {data.milestones.map((m) => (
            <span key={m.level} className="absolute top-[-3px] h-[18px] w-[2px] bg-neutral-800" style={{ left: `${(m.fund / max) * 100}%` }} aria-hidden="true" />
          ))}
        </div>
        <ol className="mt-3 space-y-1.5 text-xs text-neutral-800">
          {data.milestones.map((m) => (
            <li key={m.level}>
              <span className="font-semibold text-text">
                {data.milestone >= m.level ? "✓ " : ""}
                {m.name} ({money(m.fund)})
              </span>
              : {m.effect}
            </li>
          ))}
        </ol>
        {contributors.length > 0 && (
          <p className="mt-2 text-xs text-neutral-700">Contributors: {contributors.map(([r, n]) => `${r} ${money(n)}`).join(" · ")}</p>
        )}
      </div>
      {canContribute && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (Number(amount) > 0) contribute.mutate();
          }}
        >
          <label className="text-sm">
            Contribute ($ millions)
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 block w-32 rounded-full border-2 border-divider bg-bg px-3 py-1.5"
            />
          </label>
          <PillButton type="submit" size="sm" tone="sage" disabled={contribute.isPending || !(Number(amount) > 0)}>
            Contribute
          </PillButton>
          {contribute.error && <span className="text-sm text-accent-800">{(contribute.error as Error).message}</span>}
        </form>
      )}
    </section>
  );
}
