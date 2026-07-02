"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { QueryError } from "@/components/query-error";

interface EmergencyRequest {
  id: number;
  requestingRegionId: string;
  amountRequested: number;
  reason: string;
  status: string;
  totalContributed: number;
  createdAt: string;
  contributions: { regionId: string; amount: number }[];
}

interface DashboardData {
  ownRegion: { regionId: string } | null;
}

export default function EmergencyFundingPage() {
  const qc = useQueryClient();
  const { data: dash } = useQuery({ queryKey: ["dashboard"], queryFn: () => apiFetch<DashboardData>("/api/dashboard") });
  const { data, error, refetch } = useQuery({
    queryKey: ["emergency-funding"],
    queryFn: () => apiFetch<{ requests: EmergencyRequest[] }>("/api/emergency-funding"),
    refetchInterval: 8000,
  });

  const [amountRequested, setAmountRequested] = useState("");
  const [reason, setReason] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [contributionAmounts, setContributionAmounts] = useState<Record<number, string>>({});

  const createRequest = useMutation({
    mutationFn: () => apiFetch("/api/emergency-funding", { method: "POST", body: JSON.stringify({ amountRequested: Number(amountRequested), reason }) }),
    onSuccess: () => {
      setAmountRequested("");
      setReason("");
      setCreateError(null);
      qc.invalidateQueries({ queryKey: ["emergency-funding"] });
    },
    onError: (e: Error) => setCreateError(e.message),
  });

  const contribute = useMutation({
    mutationFn: ({ requestId, amount }: { requestId: number; amount: number }) =>
      apiFetch("/api/emergency-funding", { method: "PATCH", body: JSON.stringify({ requestId, amount }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["emergency-funding"] }),
  });

  if (error) return <QueryError error={error} onRetry={() => refetch()} label="emergency funding requests" />;

  const ownRegion = dash?.ownRegion?.regionId;
  const hasOpenRequest = (data?.requests ?? []).some((r) => r.requestingRegionId === ownRegion && r.status === "open");

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Emergency Funding</h2>
        <p className="text-sm text-slate-400 mt-1">
          Request emergency funding from every other region and WHO HQ. Each can choose to contribute part of their
          own funds or decline — the instructor decides when to close the request and disburse whatever&apos;s been
          pledged.
        </p>
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
        <h3 className="font-medium">Open a Request</h3>
        {hasOpenRequest ? (
          <p className="text-sm text-amber-400">Your region already has an open request — wait for the instructor to close it before opening another.</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (Number(amountRequested) > 0 && reason.trim()) createRequest.mutate();
            }}
            className="space-y-3"
          >
            <label className="text-sm block">
              Amount requested
              <input type="number" min={1} value={amountRequested} onChange={(e) => setAmountRequested(e.target.value)} className="mt-1 block w-48 rounded-md bg-slate-800 border border-slate-700 px-2 py-2" />
            </label>
            <label className="text-sm block">
              Reason
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1 block w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2" />
            </label>
            {createError && <p className="text-sm text-red-400">{createError}</p>}
            <button type="submit" disabled={createRequest.isPending} className="rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2">
              {createRequest.isPending ? "Submitting..." : "Submit Request"}
            </button>
          </form>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">All Requests</h3>
        {(data?.requests ?? []).map((r) => (
          <div key={r.id} className={`bg-slate-900 border rounded-lg p-4 space-y-2 ${r.status === "open" ? "border-amber-800" : "border-slate-800"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-sm">{r.requestingRegionId} requests ${r.amountRequested.toLocaleString()}</p>
                <p className="text-xs text-slate-400 mt-1">{r.reason}</p>
              </div>
              <span className={`text-xs uppercase font-semibold shrink-0 ${r.status === "open" ? "text-amber-400" : "text-emerald-400"}`}>{r.status}</span>
            </div>
            <p className="text-xs text-slate-500">
              ${r.totalContributed.toLocaleString()} contributed so far
              {r.contributions.length > 0 && ` (${r.contributions.map((c) => `${c.regionId}: $${c.amount.toLocaleString()}`).join(", ")})`}
            </p>
            {r.status === "open" && r.requestingRegionId !== ownRegion && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={contributionAmounts[r.id] ?? ""}
                  onChange={(e) => setContributionAmounts({ ...contributionAmounts, [r.id]: e.target.value })}
                  placeholder="Contribution"
                  className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm w-32"
                />
                <button
                  onClick={() => contribute.mutate({ requestId: r.id, amount: Number(contributionAmounts[r.id]) || 0 })}
                  disabled={contribute.isPending}
                  className="rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3 py-1.5"
                >
                  Contribute
                </button>
              </div>
            )}
          </div>
        ))}
        {data?.requests.length === 0 && <p className="text-slate-500 text-sm">No emergency funding requests yet.</p>}
      </section>
    </div>
  );
}
