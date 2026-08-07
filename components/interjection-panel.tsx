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
    <section className="space-y-3 rounded-lg bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-text">Scripted Interjections</h2>
        <select value={target} onChange={(e) => setTarget(e.target.value)} className="rounded-full border-2 border-divider bg-bg px-3 py-1.5 text-xs">
          <option value="all">Whole room</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r} only</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {INTERJECTIONS.map((i) => (
          <button
            key={i.id}
            onClick={() => fire.mutate(i.id)}
            disabled={fire.isPending}
            className="rounded-md bg-bg px-2 py-2 text-left text-xs font-medium text-text transition-colors duration-150 hover:bg-accent-100 hover:text-accent-800 disabled:opacity-50"
          >
            {i.title}
          </button>
        ))}
      </div>
      {lastFired && <p className="text-xs font-medium text-accent-700">Fired &quot;{lastFired}&quot; to {target === "all" ? "the whole room" : target}.</p>}
    </section>
  );
}
