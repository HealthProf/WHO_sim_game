"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { mapNarrativeDayToGameDay } from "@/lib/game-day";
import { QueryError } from "@/components/query-error";
import { EmergencyCommitteePanel } from "@/components/emergency-committee-panel";
import Link from "next/link";

interface EventFull {
  id: string;
  title: string;
  day: number;
  isAnchor: boolean;
  isCorePath: boolean;
  scope: string;
  triggerConditionDesc: string;
  modelDeltaDesc: string;
  narrativeMarkdown: string;
}

interface Dispatch {
  id: number;
  eventId: string;
  targetTeamId: number | null;
  status: string;
  revealedToPublic: boolean;
}

interface TeamRef {
  id: number;
  regionId: string;
}

interface EventsData {
  events: EventFull[];
  dispatches: Dispatch[];
  chainStatus: Record<string, { ok: boolean; blockedBy: string[] }>;
  teams: TeamRef[];
}

interface DashboardData {
  globalState: { simulationStatus: string; currentDay: number; escalationState: string; totalGameDays: number };
}

interface InboxItem {
  decision: { id: number; submittedAt: string };
  mandatoryReview: boolean;
  ageMs: number;
}

const statusChipColor: Record<string, string> = {
  dispatched: "bg-amber-900/60 text-amber-300",
  responded: "bg-blue-900/60 text-blue-300",
  scored: "bg-emerald-900/60 text-emerald-300",
  closed: "bg-slate-800 text-slate-400",
};

export default function ControlPage() {
  const qc = useQueryClient();
  const [coreOnly, setCoreOnly] = useState(false);
  const { data, error, refetch } = useQuery({ queryKey: ["events"], queryFn: () => apiFetch<EventsData>("/api/events"), refetchInterval: 10000 });
  const { data: dash, error: dashError, refetch: refetchDash } = useQuery({ queryKey: ["dashboard"], queryFn: () => apiFetch<DashboardData>("/api/dashboard"), refetchInterval: 10000 });
  const { data: inbox } = useQuery({ queryKey: ["scoring-inbox"], queryFn: () => apiFetch<{ inbox: InboxItem[] }>("/api/scores"), refetchInterval: 10000 });

  const setStatus = useMutation({
    mutationFn: (status: string) => apiFetch("/api/instructor/simulation", { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
  });

  const dispatchEvent = useMutation({
    mutationFn: (eventId: string) => apiFetch("/api/events", { method: "POST", body: JSON.stringify({ eventId, targetTeamId: null }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });

  const pushToGlobal = useMutation({
    mutationFn: ({ dispatchId, headline }: { dispatchId: number; headline: string }) =>
      apiFetch("/api/events", { method: "PATCH", body: JSON.stringify({ dispatchId, headline }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });

  if (error) return <QueryError error={error} onRetry={() => refetch()} label="events" />;
  if (dashError) return <QueryError error={dashError} onRetry={() => refetchDash()} label="dashboard state" />;
  if (!data || !dash) return <p className="text-slate-400">Loading command center...</p>;

  const status = dash.globalState.simulationStatus;
  const inboxCount = inbox?.inbox.length ?? 0;
  const mandatoryCount = inbox?.inbox.filter((i) => i.mandatoryReview).length ?? 0;
  const oldestMs = inbox?.inbox.length ? Math.max(...inbox.inbox.map((i) => i.ageMs)) : 0;

  const teamsByRegionId = new Map(data.teams.map((t) => [t.id, t.regionId]));
  const allRegionIds = data.teams.map((t) => t.regionId).sort();

  const totalGameDays = dash.globalState.totalGameDays;
  const visibleEvents = coreOnly ? data.events.filter((e) => e.isCorePath) : data.events;
  const eventsByGameDay = new Map<number, { narrativeDay: number; events: EventFull[] }>();
  for (const e of visibleEvents.slice().sort((a, b) => a.day - b.day)) {
    const gameDay = mapNarrativeDayToGameDay(e.day, totalGameDays);
    if (!eventsByGameDay.has(gameDay)) eventsByGameDay.set(gameDay, { narrativeDay: e.day, events: [] });
    eventsByGameDay.get(gameDay)!.events.push(e);
  }

  return (
    <div className="space-y-8">
      {/* Simulation status controls */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Simulation Status</p>
          <p className="text-2xl font-semibold capitalize">{status.replace("_", " ")}</p>
        </div>
        <div className="ml-auto flex gap-2">
          {status !== "running" && (
            <button onClick={() => setStatus.mutate("running")} className="rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2">
              {status === "not_started" ? "Start Simulation" : "Resume"}
            </button>
          )}
          {status === "running" && (
            <button onClick={() => setStatus.mutate("paused")} className="rounded-md bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium px-4 py-2">
              Pause
            </button>
          )}
          {status !== "completed" && (
            <button
              onClick={() => {
                if (window.confirm("End the game now? This is reversible with Reopen, but every screen will switch to the summary report.")) {
                  setStatus.mutate("completed");
                }
              }}
              className="rounded-md bg-red-700 hover:bg-red-600 text-white text-sm font-medium px-4 py-2"
            >
              End Game
            </button>
          )}
          {status === "completed" && (
            <button onClick={() => setStatus.mutate("running")} className="rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2">
              Reopen
            </button>
          )}
        </div>
      </section>

      {/* Needs your attention */}
      <section className={`rounded-xl p-5 border ${inboxCount > 0 ? "bg-amber-950/40 border-amber-700" : "bg-slate-900 border-slate-800"}`}>
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Needs Your Attention</p>
            <p className="text-lg font-semibold">
              {inboxCount === 0
                ? "Scoring inbox is empty — nothing waiting on you right now."
                : `${inboxCount} submission${inboxCount === 1 ? "" : "s"} awaiting scoring`}
            </p>
          </div>
          {inboxCount > 0 && (
            <div className="flex gap-6 text-sm text-slate-300">
              <span>Oldest: {Math.round(oldestMs / 60000)}m</span>
              {mandatoryCount > 0 && <span className="text-red-400 font-semibold">{mandatoryCount} mandatory review</span>}
            </div>
          )}
          {inboxCount > 0 && (
            <Link href="/scoring" className="ml-auto rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2">
              Go to Scoring Inbox
            </Link>
          )}
        </div>
      </section>

      <EmergencyCommitteePanel />

      {/* Event queue, grouped by day */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Event Queue</h2>
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setCoreOnly(false)}
              className={`rounded-full px-3 py-1 font-medium ${!coreOnly ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"}`}
            >
              All 16 events
            </button>
            <button
              onClick={() => setCoreOnly(true)}
              className={`rounded-full px-3 py-1 font-medium ${coreOnly ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"}`}
            >
              Core path only (~60min)
            </button>
          </div>
        </div>
        <div className="space-y-6">
          {[...eventsByGameDay.entries()].map(([gameDay, group]) => (
            <div key={gameDay}>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Game Day {gameDay} <span className="text-slate-600 normal-case">(narrative Day {group.narrativeDay})</span>
              </h3>
              <div className="space-y-3">
                {group.events.map((e) => {
                  const dispatches = data.dispatches.filter((d) => d.eventId === e.id);
                  const chain = data.chainStatus[e.id];
                  const allScored = dispatches.length > 0 && dispatches.every((d) => d.status === "scored" || d.status === "closed");
                  const borderColor = !chain?.ok
                    ? "border-slate-800"
                    : allScored
                      ? "border-emerald-800"
                      : dispatches.length > 0
                        ? "border-blue-800"
                        : "border-slate-800";

                  // For GLOBAL/MULTI events dispatched to every team, show a
                  // per-region checklist (not just a count) so the
                  // facilitator can call out exactly who hasn't responded
                  // while circulating the room.
                  const dispatchedRegions = new Map(
                    dispatches.filter((d) => d.targetTeamId != null).map((d) => [teamsByRegionId.get(d.targetTeamId!) ?? "?", d])
                  );
                  const showFullRegionChecklist = (e.scope === "GLOBAL" || e.scope === "MULTI") && dispatches.length > 1;

                  return (
                    <div key={e.id} className={`bg-slate-900 border ${borderColor} rounded-lg p-4`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium flex items-center gap-2 flex-wrap">
                            {e.title} <span className="text-xs text-slate-500">({e.id}, {e.scope})</span>
                            <span
                              className={`text-[10px] uppercase font-semibold rounded-full px-2 py-0.5 ${
                                e.isCorePath ? "bg-blue-950 text-blue-300" : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {e.isCorePath ? "Core" : "Optional"}
                            </span>
                          </p>
                          <p className="text-xs text-slate-500 mt-1">{e.triggerConditionDesc}</p>
                          <p className="text-xs text-slate-400 mt-2 max-w-xl">{e.modelDeltaDesc}</p>
                        </div>
                        <div className="flex flex-col gap-2 items-end shrink-0">
                          <button
                            disabled={!chain?.ok || dispatchEvent.isPending}
                            onClick={() => dispatchEvent.mutate(e.id)}
                            className="rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium px-3 py-1.5"
                            title={!chain?.ok ? `Blocked by: ${chain?.blockedBy.join(", ")}` : ""}
                          >
                            {dispatches.length > 0 ? "Re-dispatch" : "Dispatch Now"}
                          </button>
                          {!chain?.ok && <span className="text-xs text-red-400">Blocked: {chain.blockedBy.join(", ")}</span>}
                          {allScored && <span className="text-xs text-emerald-400 font-semibold">All scored</span>}
                        </div>
                      </div>

                      {showFullRegionChecklist && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {allRegionIds.map((regionId) => {
                            const d = dispatchedRegions.get(regionId);
                            const colorClass = d ? statusChipColor[d.status] ?? "bg-slate-800 text-slate-400" : "bg-slate-900 text-slate-600 border border-slate-800";
                            return (
                              <span key={regionId} className={`rounded-full px-2.5 py-1 text-xs font-medium ${colorClass}`}>
                                {regionId}
                                {d?.revealedToPublic ? " ✓" : ""}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {dispatches.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {dispatches.map((d) => (
                            <div key={d.id} className="flex items-center gap-2 bg-slate-800/60 rounded-full px-3 py-1 text-xs">
                              <span>
                                #{d.id} {d.targetTeamId ? `(${teamsByRegionId.get(d.targetTeamId) ?? "?"})` : ""} · {d.status}
                              </span>
                              {!d.revealedToPublic && (
                                <button
                                  onClick={() => pushToGlobal.mutate({ dispatchId: d.id, headline: `${e.title} — now live` })}
                                  className="text-blue-400 hover:text-blue-300"
                                >
                                  Push to Global Display
                                </button>
                              )}
                              {d.revealedToPublic && <span className="text-emerald-400">on display</span>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
