"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { QueryError } from "@/components/query-error";
import { REGIONS } from "@/lib/regions";

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
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Resource Pledges</h2>
        <p className="text-sm text-slate-400 mt-1">
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
        className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3"
      >
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-sm">
            To region
            <select value={toRegionId} onChange={(e) => setToRegionId(e.target.value)} className="mt-1 w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2">
              <option value="" disabled>Select region</option>
              {otherRegions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Resource
            <select value={resourceType} onChange={(e) => setResourceType(e.target.value)} className="mt-1 w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2">
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
              className="mt-1 w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2"
            />
          </label>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={pledge.isPending}
          className="rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
        >
          {pledge.isPending ? "Pledging..." : "Pledge Resources"}
        </button>
      </form>

      <div>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Ledger</h3>
        {isLoading && <p className="text-slate-400 text-sm">Loading...</p>}
        <div className="space-y-2">
          {(data?.pledges ?? []).map((p) => (
            <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm flex items-center justify-between">
              <span>
                <span className="font-medium">{p.fromRegionId}</span> → <span className="font-medium">{p.toRegionId}</span>:{" "}
                {p.amount.toLocaleString()} {RESOURCE_OPTIONS.find((r) => r.value === p.resourceType)?.label ?? p.resourceType}
              </span>
              <span className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleTimeString()}</span>
            </div>
          ))}
          {data?.pledges.length === 0 && <p className="text-slate-500 text-sm">No pledges yet.</p>}
        </div>
      </div>
    </div>
  );
}
