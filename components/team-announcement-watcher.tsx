"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { TeamAnnouncementModal } from "./team-announcement-modal";

interface DashboardAnnouncementsOnly {
  announcements: { id: number; kind: string; title: string; message: string }[];
}

// Mounted once in the (dashboard) layout (not per-page) so a "new event
// dispatched" or "final decision" popup follows the team across every page
// they might be on — orientation, events, coordination, pledges, profile —
// not just the Situation Room. Shares the same ["dashboard"] query cache
// key as the dashboard page's own query, so this doesn't add an extra poll.
export function TeamAnnouncementWatcher() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardAnnouncementsOnly>("/api/dashboard"),
    refetchInterval: 15000,
  });

  return <TeamAnnouncementModal announcements={data?.announcements ?? []} />;
}
