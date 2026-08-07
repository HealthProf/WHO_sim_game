"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { QueryError } from "@/components/query-error";
import { Chip } from "@/components/ui/chip";
import { PillButton } from "@/components/ui/pill-button";

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
    <div className="flex max-w-3xl flex-col gap-[26px]">
      <div>
        <h1 className="font-heading text-[32px] text-text">Emergency Funding</h1>
        <p className="mt-1 text-sm text-neutral-700">
          Request emergency funding from every other region and WHO HQ. Each can choose to contribute part of their
          own funds or decline — the instructor decides when to close the request and disburse whatever&apos;s been
          pledged.
        </p>
      </div>

      <section className="space-y-3 rounded-lg bg-surface p-5">
        <h2 className="font-heading text-[21px] text-text">Open a Request</h2>
        {hasOpenRequest ? (
          <p className="text-sm font-medium text-accent-700">Your region already has an open request — wait for the instructor to close it before opening another.</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (Number(amountRequested) > 0 && reason.trim()) createRequest.mutate();
            }}
            className="space-y-3"
          >
            <label className="block text-sm">
              Amount requested
              <input type="number" min={1} value={amountRequested} onChange={(e) => setAmountRequested(e.target.value)} className="mt-1 block w-48 rounded-full border-2 border-divider bg-bg px-4 py-2" />
            </label>
            <label className="block text-sm">
              Reason
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1 block w-full rounded-lg border-2 border-divider bg-bg px-4 py-2" />
            </label>
            {createError && <p className="text-sm font-medium text-accent-800">{createError}</p>}
            <PillButton type="submit" disabled={createRequest.isPending} tone="accent">
              {createRequest.isPending ? "Submitting..." : "Submit Request"}
            </PillButton>
          </form>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-text">All Requests</h2>
        {(data?.requests ?? []).map((r) => (
          <div key={r.id} className={`space-y-2 rounded-lg p-4 ${r.status === "open" ? "bg-accent-100" : "bg-surface"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-text">{r.requestingRegionId} requests ${r.amountRequested.toLocaleString()}</p>
                <p className="mt-1 text-xs text-neutral-700">{r.reason}</p>
              </div>
              <Chip tone={r.status === "open" ? "accent-solid" : "sage-soft"}>{r.status}</Chip>
            </div>
            <p className="text-xs text-neutral-700">
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
                  className="w-32 rounded-full border-2 border-divider bg-bg px-3 py-1.5 text-sm"
                />
                <PillButton
                  size="sm"
                  tone="sage"
                  onClick={() => contribute.mutate({ requestId: r.id, amount: Number(contributionAmounts[r.id]) || 0 })}
                  disabled={contribute.isPending}
                >
                  Contribute
                </PillButton>
              </div>
            )}
          </div>
        ))}
        {data?.requests.length === 0 && <p className="text-sm text-neutral-700">No emergency funding requests yet.</p>}
      </section>
    </div>
  );
}
