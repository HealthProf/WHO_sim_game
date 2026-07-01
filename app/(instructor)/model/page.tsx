"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

interface ModelStateRow {
  regionId: string;
  rt: number;
  cfrMultiplier: number;
  fundRemaining: number;
  ppeDaysRemaining: number;
  antiviralsRemaining: number;
  hcwSurgePct: number;
  politicalTensionIndex: number;
  publicTrustIndex: number;
  surveillanceIndex: number;
  hospitalCapacityPct: number;
}

interface DashboardData {
  allRegionsFull: ModelStateRow[] | null;
}

const EDITABLE_FIELDS: (keyof ModelStateRow)[] = [
  "rt",
  "cfrMultiplier",
  "surveillanceIndex",
  "hospitalCapacityPct",
  "politicalTensionIndex",
  "publicTrustIndex",
];

export default function ModelOverridePage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["dashboard"], queryFn: () => apiFetch<DashboardData>("/api/dashboard"), refetchInterval: 10000 });
  const [region, setRegion] = useState<string | null>(null);
  const [field, setField] = useState<keyof ModelStateRow>("rt");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");

  const override = useMutation({
    mutationFn: () =>
      apiFetch("/api/model", {
        method: "PATCH",
        body: JSON.stringify({ regionId: region, fields: { [field]: Number(value) }, reason }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      setValue("");
      setReason("");
    },
  });

  if (!data?.allRegionsFull) return <p className="text-slate-400">Loading model state...</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Model State Override</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-800">
              <th className="py-2 pr-4">Region</th>
              {EDITABLE_FIELDS.map((f) => (
                <th key={f} className="py-2 pr-4">{f}</th>
              ))}
              <th>Fund</th>
              <th>PPE</th>
              <th>AV</th>
              <th>HCW%</th>
            </tr>
          </thead>
          <tbody>
            {data.allRegionsFull.map((r) => (
              <tr key={r.regionId} className="border-b border-slate-900">
                <td className="py-2 pr-4 font-medium">{r.regionId}</td>
                {EDITABLE_FIELDS.map((f) => (
                  <td key={f} className="py-2 pr-4">{(r[f] as number).toFixed?.(2) ?? r[f]}</td>
                ))}
                <td>${(r.fundRemaining / 1_000_000).toFixed(1)}M</td>
                <td>{r.ppeDaysRemaining}</td>
                <td>{r.antiviralsRemaining}</td>
                <td>{r.hcwSurgePct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (region && value && reason) override.mutate();
        }}
        className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3 max-w-md"
      >
        <p className="text-sm font-medium">Manual Override</p>
        <select value={region ?? ""} onChange={(e) => setRegion(e.target.value)} className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm">
          <option value="" disabled>Select region</option>
          {data.allRegionsFull.map((r) => (
            <option key={r.regionId} value={r.regionId}>{r.regionId}</option>
          ))}
        </select>
        <select value={field} onChange={(e) => setField(e.target.value as keyof ModelStateRow)} className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm">
          {EDITABLE_FIELDS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <input value={value} onChange={(e) => setValue(e.target.value)} type="number" step="0.01" placeholder="New value" className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required for audit trail)" className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
        <button className="rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2">Apply Override</button>
      </form>
    </div>
  );
}
