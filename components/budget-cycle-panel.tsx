"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

const REGIONS = ["AFRO", "AMRO", "EMRO", "EURO", "SEARO", "WPRO"];

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
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
      <h2 className="text-lg font-semibold">Budget Cycle #{cycle.cycleNumber}</h2>
      {cycle.status === "pending_instructor" && (
        <div className="space-y-3">
          <p className="text-sm text-slate-400">
            Due now — every 14 narrative days. Standard disbursement per region: {Object.entries(data.defaults).map(([r, amt]) => `${r} $${amt.toLocaleString()}`).join(", ")}.
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => pickMode.mutate({ mode: "default" })} disabled={pickMode.isPending} className="rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2">
              Push Default to All
            </button>
            <button onClick={openCustom} className="rounded-md bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-2">
              Adjust Amounts
            </button>
            <button onClick={() => pickMode.mutate({ mode: "snap_vote" })} disabled={pickMode.isPending} className="rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2">
              Snap Decision (accept or request more)
            </button>
          </div>
          {customOpen && (
            <div className="bg-slate-800/60 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {REGIONS.map((r) => (
                  <label key={r} className="text-xs">
                    {r}
                    <input
                      type="number"
                      min={0}
                      value={customAmounts[r] ?? ""}
                      onChange={(e) => setCustomAmounts({ ...customAmounts, [r]: e.target.value })}
                      className="mt-1 w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1"
                    />
                  </label>
                ))}
              </div>
              <button
                onClick={() =>
                  pickMode.mutate({ mode: "custom", amounts: Object.fromEntries(REGIONS.map((r) => [r, Number(customAmounts[r]) || 0])) })
                }
                disabled={pickMode.isPending}
                className="rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3 py-1.5"
              >
                Confirm & Push Custom Amounts
              </button>
            </div>
          )}
        </div>
      )}
      {cycle.status === "collecting_responses" && (
        <p className="text-sm text-amber-400">
          Regions are deciding whether to accept the default or request more ({data.responses?.length ?? 0}/6 responded so far).
        </p>
      )}
      {cycle.status === "collecting_donations" && (
        <p className="text-sm text-purple-400">
          A region requested more — other regions are deciding whether to donate part of their disbursement ({data.donations?.length ?? 0} donations so far).
        </p>
      )}
    </section>
  );
}
