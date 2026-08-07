"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { REGIONS } from "@/lib/regions";
import { PillButton } from "@/components/ui/pill-button";

interface BudgetCycleData {
  cycle: { id: number; cycleNumber: number; status: string; mode: string | null; closesAt: string | null } | null;
  defaults: Record<string, number>;
  responses?: { regionId: string; choice: string; requestedAmount: number | null; amountDisbursed: number | null }[];
  donations?: { fromRegionId: string; toRegionId: string; amount: number }[];
}

// Item 2's periodic budget cycle, instructor side — see lib/budget-cycle.ts.
// Only renders anything once a cycle is pending or in progress; silent
// otherwise (a new one gets created automatically every 14 narrative days).
export function BudgetCyclePanel() {
  const qc = useQueryClient();
  const [customOpen, setCustomOpen] = useState(false);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const { data } = useQuery({
    queryKey: ["instructor-budget-cycle"],
    queryFn: () => apiFetch<BudgetCycleData>("/api/instructor/budget-cycle"),
    refetchInterval: 5000,
  });

  const pickMode = useMutation({
    mutationFn: (opts: { mode: "default" | "custom" | "snap_vote"; amounts?: Record<string, number> }) =>
      apiFetch("/api/instructor/budget-cycle", { method: "POST", body: JSON.stringify({ cycleId: data?.cycle?.id, ...opts }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instructor-budget-cycle"] });
      setCustomOpen(false);
    },
  });

  if (!data?.cycle) return null;
  const { cycle } = data;

  function openCustom() {
    setCustomAmounts(Object.fromEntries(REGIONS.map((r) => [r, String(data!.defaults[r] ?? 0)])));
    setCustomOpen(true);
  }

  return (
    <section className="space-y-3 rounded-lg bg-surface p-5">
      <h2 className="font-heading text-[21px] text-text">Budget Cycle #{cycle.cycleNumber}</h2>
      {cycle.status === "pending_instructor" && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-700">
            Due now — every 14 narrative days. Standard disbursement per region: {Object.entries(data.defaults).map(([r, amt]) => `${r} $${amt.toLocaleString()}`).join(", ")}.
          </p>
          <div className="flex flex-wrap gap-2">
            <PillButton tone="sage" onClick={() => pickMode.mutate({ mode: "default" })} disabled={pickMode.isPending}>
              Push Default to All
            </PillButton>
            <PillButton tone="ghost" onClick={openCustom}>
              Adjust Amounts
            </PillButton>
            <PillButton tone="accent" onClick={() => pickMode.mutate({ mode: "snap_vote" })} disabled={pickMode.isPending}>
              Snap Decision (accept or request more)
            </PillButton>
          </div>
          {customOpen && (
            <div className="space-y-2 rounded-lg bg-bg p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {REGIONS.map((r) => (
                  <label key={r} className="text-xs">
                    {r}
                    <input
                      type="number"
                      min={0}
                      value={customAmounts[r] ?? ""}
                      onChange={(e) => setCustomAmounts({ ...customAmounts, [r]: e.target.value })}
                      className="mt-1 w-full rounded-full border-2 border-divider bg-surface px-3 py-1"
                    />
                  </label>
                ))}
              </div>
              <PillButton
                size="sm"
                tone="sage"
                onClick={() =>
                  pickMode.mutate({ mode: "custom", amounts: Object.fromEntries(REGIONS.map((r) => [r, Number(customAmounts[r]) || 0])) })
                }
                disabled={pickMode.isPending}
              >
                Confirm & Push Custom Amounts
              </PillButton>
            </div>
          )}
        </div>
      )}
      {cycle.status === "collecting_responses" && (
        <p className="text-sm font-medium text-accent-700">
          Regions are deciding whether to accept the default or request more ({data.responses?.length ?? 0}/6 responded so far).
        </p>
      )}
      {cycle.status === "collecting_donations" && (
        <p className="text-sm font-medium text-neutral-700">
          A region requested more — other regions are deciding whether to donate part of their disbursement ({data.donations?.length ?? 0} donations so far).
        </p>
      )}
    </section>
  );
}
