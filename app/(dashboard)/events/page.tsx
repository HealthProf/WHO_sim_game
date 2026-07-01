"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { mapNarrativeDayToGameDay } from "@/lib/game-day";
import { realMsToGameDays, formatGameDays } from "@/lib/sim-clock";
import { QueryError } from "@/components/query-error";
import Link from "next/link";

interface EventsData {
  events: { id: string; title: string; day: number; deadlineType: string }[];
  dispatches: { id: number; eventId: string; status: string; deadlineAt: string | null; dispatchedAt: string }[];
}

interface DashboardData {
  globalState: { totalGameDays: number; gameDaysPerRealMinute: number };
}

const statusColor: Record<string, string> = {
  dispatched: "text-amber-400",
  responded: "text-blue-400",
  scored: "text-emerald-400",
  closed: "text-slate-500",
};

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
  if (isLoading || !data) return <p className="text-slate-400">Loading events...</p>;

  const totalGameDays = dash?.globalState.totalGameDays ?? 90;
  const gameDaysPerRealMinute = dash?.globalState.gameDaysPerRealMinute ?? 1.5;

  const dispatchesByEvent = data.dispatches
    .slice()
    .sort((a, b) => new Date(b.dispatchedAt).getTime() - new Date(a.dispatchedAt).getTime());

  if (dispatchesByEvent.length === 0) {
    return <p className="text-slate-400">No events have been dispatched to your team yet.</p>;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold mb-3">Your Events</h2>
      {dispatchesByEvent.map((d) => {
        const event = data.events.find((e) => e.id === d.eventId);
        const gameDay = event ? mapNarrativeDayToGameDay(event.day, totalGameDays) : null;
        return (
          <Link
            key={d.id}
            href={`/events/${d.id}`}
            className="block bg-slate-900 border border-slate-800 rounded-lg p-4 hover:border-slate-700 transition"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{event?.title ?? d.eventId}</p>
                <p className="text-xs text-slate-500">
                  {d.eventId} · Game Day {gameDay}
                </p>
              </div>
              <span className={`text-xs font-medium uppercase ${statusColor[d.status] ?? "text-slate-400"}`}>{d.status}</span>
            </div>
            {d.deadlineAt && <Countdown deadlineAt={d.deadlineAt} gameDaysPerRealMinute={gameDaysPerRealMinute} />}
          </Link>
        );
      })}
    </div>
  );
}

function Countdown({ deadlineAt, gameDaysPerRealMinute }: { deadlineAt: string; gameDaysPerRealMinute: number }) {
  const remaining = new Date(deadlineAt).getTime() - Date.now();
  const expired = remaining <= 0;
  const minutes = Math.max(0, Math.floor(remaining / 60000));
  const seconds = Math.max(0, Math.floor((remaining % 60000) / 1000));
  const gameDaysRemaining = realMsToGameDays(Math.max(0, remaining), gameDaysPerRealMinute);
  return (
    <p className={`text-xs mt-2 ${expired ? "text-red-400" : "text-slate-400"}`}>
      {expired ? "Deadline passed" : `Deadline in ${minutes}m ${seconds}s (≈ ${formatGameDays(gameDaysRemaining)})`}
    </p>
  );
}
