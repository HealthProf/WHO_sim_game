"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { SimClock } from "./sim-clock";
import type { GlobalClockFields } from "@/lib/sim-clock";

interface DashboardClockData {
  globalState: GlobalClockFields;
}

// Small header-embedded version of the sim clock. Polls the same dashboard
// endpoint teams/instructor already use, then ticks locally every second
// between polls (see SimClock).
export function HeaderClock() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardClockData>("/api/dashboard"),
    refetchInterval: 15000,
  });

  if (!data?.globalState) return null;

  return <SimClock state={data.globalState} size="md" />;
}
