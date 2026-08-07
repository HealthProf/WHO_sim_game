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
    <div className="flex flex-col gap-[26px]">
      <h1 className="font-heading text-[32px] text-text">Action Log</h1>
      <div className="space-y-3">
        {(data?.log ?? []).map((row) => (
          <div key={row.id} className="rounded-lg bg-surface p-3 text-sm">
            <p className="font-semibold text-text">{row.actionType}</p>
            <p className="text-neutral-700">{row.targetDesc}</p>
            {row.reason && <p className="mt-1 text-xs text-neutral-700">Reason: {row.reason}</p>}
            <p className="mt-1 text-xs text-neutral-700">{new Date(row.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
