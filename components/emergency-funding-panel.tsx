"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { PillButton } from "@/components/ui/pill-button";

interface OpenRequest {
  id: number;
  requestingRegionId: string;
  amountRequested: number;
  reason: string;
  totalContributed: number;
  whoHqContributed: boolean;
}

interface InstructorEmergencyData {
  whoHqFund: number;
  requests: OpenRequest[];
}

// Item 5's emergency funding, instructor side. WHO HQ's own fund (larger
// than any region's, never resupplied by the periodic budget cycle — see
// lib/budget-cycle.ts) can be pledged toward an open request via the same
// PATCH endpoint teams use (it treats an instructor-role session as the
// WHO HQ contributor); closing the request is instructor-only.
export function EmergencyFundingPanel() {
  const qc = useQueryClient();
  const [contribAmounts, setContribAmounts] = useState<Record<number, string>>({});

  const { data } = useQuery({
    queryKey: ["instructor-emergency-funding"],
    queryFn: () => apiFetch<InstructorEmergencyData>("/api/instructor/emergency-funding"),
    refetchInterval: 5000,
  });

  const contribute = useMutation({
    mutationFn: ({ requestId, amount }: { requestId: number; amount: number }) =>
      apiFetch("/api/emergency-funding", { method: "PATCH", body: JSON.stringify({ requestId, amount }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instructor-emergency-funding"] }),
  });

  const closeRequest = useMutation({
    mutationFn: (requestId: number) => apiFetch("/api/instructor/emergency-funding", { method: "PATCH", body: JSON.stringify({ requestId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["instructor-emergency-funding"] }),
  });

  const requests = data?.requests ?? [];
  if (requests.length === 0) return null;

  return (
    <section className="space-y-3 rounded-lg bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-[21px] text-text">Emergency Funding Requests</h2>
        <span className="text-xs text-neutral-700">WHO HQ balance: ${(data?.whoHqFund ?? 0).toLocaleString()}</span>
      </div>
      <div className="space-y-2">
        {requests.map((r) => (
          <div key={r.id} className="space-y-2 rounded-lg bg-bg p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-text">{r.requestingRegionId} requests ${r.amountRequested.toLocaleString()}</p>
                <p className="text-xs text-neutral-700">{r.reason}</p>
                <p className="mt-1 text-xs text-neutral-700">${r.totalContributed.toLocaleString()} contributed so far</p>
              </div>
              <PillButton size="sm" tone="accent" onClick={() => closeRequest.mutate(r.id)} disabled={closeRequest.isPending} className="shrink-0">
                Close & Disburse
              </PillButton>
            </div>
            {!r.whoHqContributed && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={contribAmounts[r.id] ?? ""}
                  onChange={(e) => setContribAmounts({ ...contribAmounts, [r.id]: e.target.value })}
                  placeholder="WHO HQ contribution"
                  className="w-40 rounded-full border-2 border-divider bg-surface px-3 py-1.5 text-xs"
                />
                <PillButton
                  size="sm"
                  tone="sage"
                  onClick={() => contribute.mutate({ requestId: r.id, amount: Number(contribAmounts[r.id]) || 0 })}
                  disabled={contribute.isPending || !(Number(contribAmounts[r.id]) > 0)}
                >
                  Contribute as WHO HQ
                </PillButton>
              </div>
            )}
            {r.whoHqContributed && <p className="text-xs font-medium text-accent-2-700">WHO HQ has already contributed to this request.</p>}
          </div>
        ))}
      </div>
      {contribute.isError && <p className="text-sm font-medium text-accent-800">{(contribute.error as Error).message}</p>}
    </section>
  );
}
