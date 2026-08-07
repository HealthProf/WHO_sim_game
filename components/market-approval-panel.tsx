"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { Chip } from "@/components/ui/chip";
import { PillButton } from "@/components/ui/pill-button";

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
    <section className="space-y-3 rounded-lg bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-[21px] text-text">WHO HQ Marketplace</h2>
        {requests.length > 0 && <Chip tone="accent-soft">{requests.length} pending</Chip>}
      </div>
      {market && (
        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-md bg-bg p-3">
            <p className="text-xs text-neutral-700">PPE stock / current price</p>
            <p className="font-semibold text-text">{market.whoHqPpeStock.toLocaleString()} days — ${market.prices.PPE_DAYS.toLocaleString()}/unit</p>
          </div>
          <div className="rounded-md bg-bg p-3">
            <p className="text-xs text-neutral-700">Antiviral stock / current price</p>
            <p className="font-semibold text-text">{market.whoHqAntiviralsStock.toLocaleString()} doses — ${market.prices.ANTIVIRALS.toLocaleString()}/unit</p>
          </div>
        </div>
      )}
      {requests.length === 0 ? (
        <p className="text-sm text-neutral-700">No purchase requests waiting on approval.</p>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-bg p-3 text-sm">
              <span className="text-text">
                <strong>{r.regionId}</strong> wants {r.amount.toLocaleString()} {RESOURCE_LABEL[r.resourceType]} — ${r.totalCost.toLocaleString()} total (${r.pricePerUnit.toLocaleString()}/unit)
              </span>
              <div className="flex shrink-0 gap-2">
                <PillButton size="sm" tone="sage" onClick={() => resolve.mutate({ requestId: r.id, action: "approve" })} disabled={resolve.isPending}>
                  Approve
                </PillButton>
                <PillButton size="sm" tone="ghost" onClick={() => resolve.mutate({ requestId: r.id, action: "reject" })} disabled={resolve.isPending}>
                  Reject
                </PillButton>
              </div>
            </div>
          ))}
        </div>
      )}
      {resolve.isError && <p className="text-sm font-medium text-accent-800">{(resolve.error as Error).message}</p>}
    </section>
  );
}
