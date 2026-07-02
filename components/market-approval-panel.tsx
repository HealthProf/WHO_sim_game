"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

interface PendingRequest {
  id: number;
  regionId: string;
  resourceType: "PPE_DAYS" | "ANTIVIRALS";
  amount: number;
  pricePerUnit: number;
  totalCost: number;
  createdAt: string;
}

interface MarketData {
  prices: { PPE_DAYS: number; ANTIVIRALS: number };
  whoHqPpeStock: number;
  whoHqAntiviralsStock: number;
}

const RESOURCE_LABEL: Record<string, string> = { PPE_DAYS: "PPE-days", ANTIVIRALS: "antiviral doses" };

// Item 3's instructor-side approval queue for WHO HQ marketplace requests —
// see app/api/instructor/market/route.ts. A request may go stale (WHO HQ
// stock or the requesting region's fund can move between submission and
// approval); the PATCH endpoint re-validates and returns a clear error,
// surfaced here inline rather than via a toast.
export function MarketApprovalPanel() {
  const qc = useQueryClient();

  const { data: pending } = useQuery({
    queryKey: ["instructor-market"],
    queryFn: () => apiFetch<{ requests: PendingRequest[] }>("/api/instructor/market"),
    refetchInterval: 5000,
  });
  const { data: market } = useQuery({
    queryKey: ["market"],
    queryFn: () => apiFetch<MarketData>("/api/market"),
    refetchInterval: 5000,
  });

  const resolve = useMutation({
    mutationFn: ({ requestId, action }: { requestId: number; action: "approve" | "reject" }) =>
      apiFetch("/api/instructor/market", { method: "PATCH", body: JSON.stringify({ requestId, action }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instructor-market"] }),
  });

  const requests = pending?.requests ?? [];

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">WHO HQ Marketplace</h2>
        {requests.length > 0 && (
          <span className="text-xs uppercase font-semibold rounded-full px-2 py-0.5 bg-amber-900/60 text-amber-300">
            {requests.length} pending
          </span>
        )}
      </div>
      {market && (
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-xs text-slate-500">PPE stock / current price</p>
            <p className="font-semibold">{market.whoHqPpeStock.toLocaleString()} days — ${market.prices.PPE_DAYS.toLocaleString()}/unit</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Antiviral stock / current price</p>
            <p className="font-semibold">{market.whoHqAntiviralsStock.toLocaleString()} doses — ${market.prices.ANTIVIRALS.toLocaleString()}/unit</p>
          </div>
        </div>
      )}
      {requests.length === 0 ? (
        <p className="text-sm text-slate-500">No purchase requests waiting on approval.</p>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 bg-slate-800/60 rounded-lg p-3 text-sm">
              <span>
                <strong>{r.regionId}</strong> wants {r.amount.toLocaleString()} {RESOURCE_LABEL[r.resourceType]} — ${r.totalCost.toLocaleString()} total (${r.pricePerUnit.toLocaleString()}/unit)
              </span>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => resolve.mutate({ requestId: r.id, action: "approve" })}
                  disabled={resolve.isPending}
                  className="rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3 py-1.5"
                >
                  Approve
                </button>
                <button
                  onClick={() => resolve.mutate({ requestId: r.id, action: "reject" })}
                  disabled={resolve.isPending}
                  className="rounded-md bg-red-700 hover:bg-red-600 text-white text-xs font-medium px-3 py-1.5"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {resolve.isError && <p className="text-sm text-red-400">{(resolve.error as Error).message}</p>}
    </section>
  );
}
