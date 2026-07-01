"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

interface EventFull {
  id: string;
  title: string;
  day: number;
  isAnchor: boolean;
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

interface EventsData {
  events: EventFull[];
  dispatches: Dispatch[];
  chainStatus: Record<string, { ok: boolean; blockedBy: string[] }>;
}

interface DashboardData {
  globalState: { simulationStatus: string; currentDay: number; escalationState: string };
}

export default function ControlPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["events"], queryFn: () => apiFetch<EventsData>("/api/events"), refetchInterval: 10000 });
  const { data: dash } = useQuery({ queryKey: ["dashboard"], queryFn: () => apiFetch<DashboardData>("/api/dashboard"), refetchInterval: 10000 });

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

  if (!data || !dash) return <p className="text-slate-400">Loading control panel...</p>;

  const status = dash.globalState.simulationStatus;

  return (
    <div className="space-y-8">
      <section className="flex items-center gap-3">
        <span className="text-sm text-slate-400">Simulation status: <span className="font-semibold text-slate-100 capitalize">{status.replace("_", " ")}</span></span>
        <div className="ml-auto flex gap-2">
          {status !== "running" && (
            <button onClick={() => setStatus.mutate("running")} className="rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm px-3 py-1.5">
              {status === "not_started" ? "Start Simulation" : "Resume"}
            </button>
          )}
          {status === "running" && (
            <button onClick={() => setStatus.mutate("paused")} className="rounded-md bg-amber-600 hover:bg-amber-500 text-white text-sm px-3 py-1.5">
              Pause
            </button>
          )}
          {status !== "completed" && (
            <button onClick={() => setStatus.mutate("completed")} className="rounded-md bg-slate-700 hover:bg-slate-600 text-white text-sm px-3 py-1.5">
              Mark Complete
            </button>
          )}
          {status === "completed" && (
            <button onClick={() => setStatus.mutate("running")} className="rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-1.5">
              Reopen
            </button>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Event Queue</h2>
        <div className="space-y-3">
          {data.events
            .slice()
            .sort((a, b) => a.day - b.day)
            .map((e) => {
              const dispatches = data.dispatches.filter((d) => d.eventId === e.id);
              const chain = data.chainStatus[e.id];
              const alreadyDispatched = dispatches.length > 0;
              return (
                <div key={e.id} className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{e.title} <span className="text-xs text-slate-500">({e.id}, Day {e.day}, {e.scope})</span></p>
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
                        {alreadyDispatched ? "Re-dispatch" : "Dispatch Now"}
                      </button>
                      {!chain?.ok && <span className="text-xs text-red-400">Blocked: {chain.blockedBy.join(", ")}</span>}
                    </div>
                  </div>
                  {dispatches.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {dispatches.map((d) => (
                        <div key={d.id} className="flex items-center gap-2 bg-slate-800/60 rounded-full px-3 py-1 text-xs">
                          <span>#{d.id} - {d.status}</span>
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
      </section>
    </div>
  );
}
