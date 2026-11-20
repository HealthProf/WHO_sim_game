"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { mapNarrativeDayToGameDay } from "@/lib/game-day";
import { realMsToGameDays, formatGameDays } from "@/lib/sim-clock";
import { QueryError } from "@/components/query-error";
import { EventStatusBadge, STATUS_EDGE_CLASS, teamStatusOf } from "@/components/event-status-badge";
import Link from "next/link";

interface EventsData {
  events: { id: string; title: string; day: number; deadlineType: string }[];
  dispatches: { id: number; eventId: string; status: string; deadlineAt: string | null; dispatchedAt: string }[];
}

interface DashboardData {
  globalState: { totalGameDays: number; gameDaysPerRealMinute: number };
}

export default function EventsPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["events"],
    queryFn: () => apiFetch<EventsData>("/api/events"),
    refetchInterval: 15000,
  });
  const { data: dash } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardData>("/api/dashboard"),
    refetchInterval: 15000,
  });

  if (error) return <QueryError error={error} onRetry={() => refetch()} label="events" />;
  if (isLoading || !data) return <p className="text-neutral-700">Loading events...</p>;

  const totalGameDays = dash?.globalState.totalGameDays ?? 90;
  const gameDaysPerRealMinute = dash?.globalState.gameDaysPerRealMinute ?? 1.5;

  // To-do first (soonest deadline first), then submitted, then finished,
  // newest first within each group.
  const order = { todo: 0, submitted: 1, done: 2 } as const;
  const dispatchesByEvent = data.dispatches.slice().sort((a, b) => {
    const byStatus = order[teamStatusOf(a.status)] - order[teamStatusOf(b.status)];
    if (byStatus !== 0) return byStatus;
    if (a.status === "dispatched" && a.deadlineAt && b.deadlineAt) return new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime();
    return new Date(b.dispatchedAt).getTime() - new Date(a.dispatchedAt).getTime();
  });
  const counts = { todo: 0, submitted: 0, done: 0 };
  for (const d of data.dispatches) counts[teamStatusOf(d.status)]++;

  return (
    <div className="flex flex-col gap-[26px]">
      <div>
        <h1 className="font-heading text-[32px] text-text">Events</h1>
        {data.dispatches.length > 0 && (
          <p className="mt-1 text-sm text-neutral-800">
            {counts.todo} to do · {counts.submitted} submitted · {counts.done} scored or closed
          </p>
        )}
      </div>
      {dispatchesByEvent.length === 0 ? (
        <p className="text-neutral-700">No events have been dispatched to your team yet.</p>
      ) : (
        <div className="space-y-3">
          {dispatchesByEvent.map((d) => {
            const event = data.events.find((e) => e.id === d.eventId);
            const gameDay = event ? mapNarrativeDayToGameDay(event.day, totalGameDays) : null;
            return (
              <Link
                key={d.id}
                href={`/events/${d.id}`}
                className={`block rounded-lg bg-surface p-4 transition-colors duration-150 hover:bg-neutral-200 ${STATUS_EDGE_CLASS[teamStatusOf(d.status)]}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-text">{event?.title ?? d.eventId}</p>
                    <p className="text-xs text-neutral-700">
                      {d.eventId} · Game Day {gameDay}
                    </p>
                  </div>
                  <EventStatusBadge status={d.status} />
                </div>
                {d.deadlineAt && d.status === "dispatched" && <Countdown deadlineAt={d.deadlineAt} gameDaysPerRealMinute={gameDaysPerRealMinute} />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Countdown({ deadlineAt, gameDaysPerRealMinute }: { deadlineAt: string; gameDaysPerRealMinute: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remaining = new Date(deadlineAt).getTime() - now;
  const expired = remaining <= 0;
  const minutes = Math.max(0, Math.floor(remaining / 60000));
  const seconds = Math.max(0, Math.floor((remaining % 60000) / 1000));
  const gameDaysRemaining = realMsToGameDays(Math.max(0, remaining), gameDaysPerRealMinute);
  return (
    <p className={`mt-2 text-xs ${expired ? "text-accent-800" : "text-neutral-700"}`}>
      {expired ? "Deadline passed" : `Deadline in ${minutes}m ${seconds}s (≈ ${formatGameDays(gameDaysRemaining)})`}
    </p>
  );
}
