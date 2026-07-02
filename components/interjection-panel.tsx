"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { REGIONS } from "@/lib/regions";

const INTERJECTIONS = [
  { id: "journalist-call", title: "Press Inquiry" },
  { id: "rival-statement", title: "Rival Public Statement" },
  { id: "data-integrity", title: "Data Integrity Question" },
  { id: "supply-delay", title: "Supply Chain Delay" },
  { id: "staff-morale", title: "Staff Morale Flashpoint" },
  { id: "social-media", title: "Social Media Moment" },
  { id: "donor-question", title: "Donor Follow-Up" },
  { id: "unexpected-visitor", title: "Unexpected Visitor" },
  { id: "whistleblower", title: "Internal Concern Raised" },
  { id: "good-news", title: "Unexpected Good News" },
];

// Item 10's scripted interjections library — improv support for a
// facilitator who wants to inject a complication (or a break) without
// having to invent one on the spot. See lib/db/seed-data/interjections.ts
// for the full pre-written text.
export function InterjectionPanel() {
  const qc = useQueryClient();
  const [target, setTarget] = useState<"all" | string>("all");
  const [lastFired, setLastFired] = useState<string | null>(null);

  const fire = useMutation({
    mutationFn: (interjectionId: string) =>
      apiFetch("/api/instructor/interjection", {
        method: "POST",
        body: JSON.stringify({ interjectionId, targetRegionId: target === "all" ? null : target }),
      }),
    onSuccess: (_data, interjectionId) => {
      setLastFired(INTERJECTIONS.find((i) => i.id === interjectionId)?.title ?? interjectionId);
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-slate-200">Scripted Interjections</h2>
        <select value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1.5 text-xs">
          <option value="all">Whole room</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r} only</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {INTERJECTIONS.map((i) => (
          <button
            key={i.id}
            onClick={() => fire.mutate(i.id)}
            disabled={fire.isPending}
            className="rounded-md bg-slate-800 hover:bg-orange-900/60 border border-slate-700 hover:border-orange-700 text-xs font-medium px-2 py-2 text-left disabled:opacity-50"
          >
            {i.title}
          </button>
        ))}
      </div>
      {lastFired && <p className="text-xs text-orange-400">Fired &quot;{lastFired}&quot; to {target === "all" ? "the whole room" : target}.</p>}
    </section>
  );
}
