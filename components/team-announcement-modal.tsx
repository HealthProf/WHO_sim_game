"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { PillButton } from "@/components/ui/pill-button";

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

  const kindTone: Record<string, string> = {
    event_dispatched: "border-accent bg-accent-900",
    decision_resolved: "border-accent-2 bg-accent-2-900",
    snap_vote: "border-accent bg-accent-900",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className={`w-full max-w-md space-y-4 rounded-lg border-2 p-6 ${kindTone[current.kind] ?? "border-neutral-700 bg-neutral-900"}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{current.title}</p>
        <p className="text-base text-white">{current.message}</p>
        {announcements.length > 1 && <p className="text-xs text-white/60">+{announcements.length - 1} more waiting after this one</p>}
        <PillButton tone="white" onClick={() => ack.mutate(current.id)} disabled={ack.isPending} className="w-full">
          Close
        </PillButton>
      </div>
    </div>
  );
}
