"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

interface TeamAnnouncement {
  id: number;
  kind: string;
  title: string;
  message: string;
}

// Persistent popup for "new event dispatched" / "final decision" alerts
// (see lib/announcements.ts) — shows only the oldest undismissed one at a
// time so a burst of dispatches queues rather than stacking modals. Unlike
// the global-display banner, this never auto-dismisses: a missed toast is
// easy to lose during a live session, so the team has to consciously close
// it.
export function TeamAnnouncementModal({ announcements }: { announcements: TeamAnnouncement[] }) {
  const qc = useQueryClient();
  const ack = useMutation({
    mutationFn: (announcementId: number) => apiFetch("/api/announcements", { method: "POST", body: JSON.stringify({ announcementId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
  });

  if (announcements.length === 0) return null;
  const current = announcements[0];

  const kindColor: Record<string, string> = {
    event_dispatched: "border-blue-600 bg-blue-950/90",
    decision_resolved: "border-purple-600 bg-purple-950/90",
    snap_vote: "border-red-600 bg-red-950/90",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className={`max-w-md w-full rounded-xl border-2 p-6 space-y-4 ${kindColor[current.kind] ?? "border-slate-600 bg-slate-900"}`}>
        <p className="text-xs uppercase tracking-wide text-slate-300 font-semibold">{current.title}</p>
        <p className="text-base text-white">{current.message}</p>
        {announcements.length > 1 && <p className="text-xs text-slate-400">+{announcements.length - 1} more waiting after this one</p>}
        <button
          onClick={() => ack.mutate(current.id)}
          disabled={ack.isPending}
          className="w-full rounded-md bg-white text-slate-900 text-sm font-semibold px-4 py-2 hover:bg-slate-200 disabled:opacity-50"
        >
          Close
        </button>
      </div>
    </div>
  );
}
