"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { QueryError } from "@/components/query-error";
import { REGIONS } from "@/lib/regions";
import { PillButton } from "@/components/ui/pill-button";

interface Pledge {
  id: number;
  fromRegionId: string;
  toRegionId: string;
  resourceType: string;
  amount: number;
  createdAt: string;
}

const RESOURCE_OPTIONS = [
  { value: "FUND", label: "Fund ($)" },
  { value: "PPE_DAYS", label: "PPE (days)" },
  { value: "ANTIVIRALS", label: "Antivirals (doses)" },
  { value: "HCW_SURGE_PCT", label: "HCW surge capacity (%)" },
];


interface DashboardData {
  ownRegion: { regionId: string } | null;
}

export default function PledgesPage() {
  const qc = useQueryClient();
  const [toRegionId, setToRegionId] = useState("");
  const [resourceType, setResourceType] = useState("PPE_DAYS");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ["pledges"],
    queryFn: () => apiFetch<{ pledges: Pledge[] }>("/api/pledges"),
    refetchInterval: 10000,
  });
  const { data: dash } = useQuery({ queryKey: ["dashboard"], queryFn: () => apiFetch<DashboardData>("/api/dashboard") });

  const pledge = useMutation({
    mutationFn: () =>
      apiFetch("/api/pledges", {
        method: "POST",
        body: JSON.stringify({ toRegionId, resourceType, amount: Number(amount) }),
      }),
    onSuccess: () => {
      setAmount("");
      setError(null);
      qc.invalidateQueries({ queryKey: ["pledges"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (queryError) return <QueryError error={queryError} onRetry={() => refetch()} label="pledge ledger" />;

  const ownRegion = dash?.ownRegion?.regionId;
  const otherRegions = REGIONS.filter((r) => r !== ownRegion);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-[32px] text-text">Pledges</h1>
        <p className="mt-1 text-sm text-neutral-700">
          Pledge PPE, funds, antivirals, or HCW surge capacity directly to another region. This actually transfers the
          resource between live ledgers (not just a note in a rationale field) and is visible to everyone, same as
          the coordination log.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (toRegionId && Number(amount) > 0) pledge.mutate();
        }}
        className="space-y-3 rounded-lg bg-surface p-4"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            To region
            <select
              value={toRegionId}
              onChange={(e) => setToRegionId(e.target.value)}
              className="mt-1 w-full rounded-full border-2 border-divider bg-bg px-4 py-2"
            >
              <option value="" disabled>Select region</option>
              {otherRegions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Resource
            <select
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
              className="mt-1 w-full rounded-full border-2 border-divider bg-bg px-4 py-2"
            >
              {RESOURCE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Amount
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-full border-2 border-divider bg-bg px-4 py-2"
            />
          </label>
        </div>
        {error && <p className="text-sm font-medium text-accent-800">{error}</p>}
        <PillButton type="submit" disabled={pledge.isPending} tone="sage">
          {pledge.isPending ? "Pledging..." : "Pledge Resources"}
        </PillButton>
      </form>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-text">Ledger</h2>
        {isLoading && <p className="text-sm text-neutral-600">Loading...</p>}
        <div className="space-y-2">
          {(data?.pledges ?? []).map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg bg-accent-2-100 p-3 text-sm">
              <span>
                <span className="font-semibold text-accent-2-900">{p.fromRegionId}</span> → <span className="font-semibold text-accent-2-900">{p.toRegionId}</span>:{" "}
                <span className="text-accent-2-800">{p.amount.toLocaleString()} {RESOURCE_OPTIONS.find((r) => r.value === p.resourceType)?.label ?? p.resourceType}</span>
              </span>
              <span className="text-xs text-accent-2-700">{new Date(p.createdAt).toLocaleTimeString()}</span>
            </div>
          ))}
          {data?.pledges.length === 0 && <p className="text-sm text-neutral-600">No pledges yet.</p>}
        </div>
      </div>
    </div>
  );
}
