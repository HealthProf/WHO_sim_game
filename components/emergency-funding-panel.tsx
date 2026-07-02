"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

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
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Emergency Funding Requests</h2>
        <span className="text-xs text-slate-400">WHO HQ balance: ${(data?.whoHqFund ?? 0).toLocaleString()}</span>
      </div>
      <div className="space-y-2">
        {requests.map((r) => (
          <div key={r.id} className="bg-slate-800/60 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{r.requestingRegionId} requests ${r.amountRequested.toLocaleString()}</p>
                <p className="text-xs text-slate-400">{r.reason}</p>
                <p className="text-xs text-slate-500 mt-1">${r.totalContributed.toLocaleString()} contributed so far</p>
              </div>
              <button
                onClick={() => closeRequest.mutate(r.id)}
                disabled={closeRequest.isPending}
                className="rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-1.5 shrink-0"
              >
                Close & Disburse
              </button>
            </div>
            {!r.whoHqContributed && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={contribAmounts[r.id] ?? ""}
                  onChange={(e) => setContribAmounts({ ...contribAmounts, [r.id]: e.target.value })}
                  placeholder="WHO HQ contribution"
                  className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs w-40"
                />
                <button
                  onClick={() => contribute.mutate({ requestId: r.id, amount: Number(contribAmounts[r.id]) || 0 })}
                  disabled={contribute.isPending || !(Number(contribAmounts[r.id]) > 0)}
                  className="rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5"
                >
                  Contribute as WHO HQ
                </button>
              </div>
            )}
            {r.whoHqContributed && <p className="text-xs text-emerald-400">WHO HQ has already contributed to this request.</p>}
          </div>
        ))}
      </div>
      {contribute.isError && <p className="text-sm text-red-400">{(contribute.error as Error).message}</p>}
    </section>
  );
}
