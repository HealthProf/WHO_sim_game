"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

interface LogRow {
  id: number;
  actionType: string;
  targetDesc: string;
  reason: string | null;
  createdAt: string;
}

export default function ActionLogPage() {
  const { data } = useQuery({ queryKey: ["instructor-log"], queryFn: () => apiFetch<{ log: LogRow[] }>("/api/instructor/log"), refetchInterval: 15000 });

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Instructor Action Log</h2>
      {(data?.log ?? []).map((row) => (
        <div key={row.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm">
          <p className="font-medium">{row.actionType}</p>
          <p className="text-slate-400">{row.targetDesc}</p>
          {row.reason && <p className="text-slate-500 text-xs mt-1">Reason: {row.reason}</p>}
          <p className="text-xs text-slate-600 mt-1">{new Date(row.createdAt).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
