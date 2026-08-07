"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { mapNarrativeDayToGameDay } from "@/lib/game-day";
import { QueryError } from "@/components/query-error";
import { EmergencyCommitteePanel } from "@/components/emergency-committee-panel";
import { BudgetCyclePanel } from "@/components/budget-cycle-panel";
import { MarketApprovalPanel } from "@/components/market-approval-panel";
import { EmergencyFundingPanel } from "@/components/emergency-funding-panel";
import { DeadlineCountdown } from "@/components/deadline-countdown";
import { DirectorTimeline } from "@/components/director-timeline";
import { TempoDial } from "@/components/tempo-dial";
import { InterjectionPanel } from "@/components/interjection-panel";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { PillButton, PillLink } from "@/components/ui/pill-button";
import { REGIONS as ALL_REGIONS } from "@/lib/regions";

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
  suggestedTargetRegions: string[] | null;
}

interface Dispatch {
  id: number;
  eventId: string;
  targetTeamId: number | null;
  status: string;
  revealedToPublic: boolean;
  deadlineAt: string | null;
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
  targetHints: Record<string, string[]>;
}

interface DashboardData {
  globalState: {
    simulationStatus: string;
    currentDay: number;
    escalationState: string;
    totalGameDays: number;
    simulationStartedAt: string | null;
    pausedAccumulatedMs: number;
    pausedAt: string | null;
    gameDaysPerRealMinute: number;
    intensityMultiplier: number;
  };
}

interface InboxItem {
  decision: { id: number; submittedAt: string };
  mandatoryReview: boolean;
  ageMs: number;
}

const statusChipTone: Record<string, ChipTone> = {
  dispatched: "accent-soft",
  responded: "neutral-soft",
  scored: "sage-soft",
  closed: "neutral-outline",
};

export default function ControlPage() {
  const qc = useQueryClient();
  const [coreOnly, setCoreOnly] = useState(false);
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  const { data, error, refetch } = useQuery({ queryKey: ["events"], queryFn: () => apiFetch<EventsData>("/api/events"), refetchInterval: 10000 });
  const { data: dash, error: dashError, refetch: refetchDash } = useQuery({ queryKey: ["dashboard"], queryFn: () => apiFetch<DashboardData>("/api/dashboard"), refetchInterval: 10000 });
  const { data: inbox } = useQuery({ queryKey: ["scoring-inbox"], queryFn: () => apiFetch<{ inbox: InboxItem[] }>("/api/scores"), refetchInterval: 10000 });

  const setStatus = useMutation({
    mutationFn: (status: string) => apiFetch("/api/instructor/simulation", { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
  });

  const dispatchEvent = useMutation({
    mutationFn: ({ eventId, targetRegionIds }: { eventId: string; targetRegionIds: string[] }) =>
      apiFetch("/api/events", { method: "POST", body: JSON.stringify({ eventId, targetRegionIds }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      setPickerOpenFor(null);
    },
  });

  const pushToGlobal = useMutation({
    mutationFn: ({ dispatchId, headline }: { dispatchId: number; headline: string }) =>
      apiFetch("/api/events", { method: "PATCH", body: JSON.stringify({ dispatchId, headline }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });

  if (error) return <QueryError error={error} onRetry={() => refetch()} label="events" />;
  if (dashError) return <QueryError error={dashError} onRetry={() => refetchDash()} label="dashboard state" />;
  if (!data || !dash) return <p className="text-neutral-700">Loading command center...</p>;

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

  // Every currently-open (awaiting response, deadline still ticking) dispatch
  // across every event, sorted soonest-first — the point is to make it
  // possible to track several concurrent timers across different events at
  // once, not just the one you happen to be looking at.
  const activeDeadlines = data.dispatches
    .filter((d) => d.status === "dispatched" && d.deadlineAt)
    .map((d) => ({ dispatch: d, event: data.events.find((e) => e.id === d.eventId) }))
    .filter((x) => x.event)
    .sort((a, b) => new Date(a.dispatch.deadlineAt!).getTime() - new Date(b.dispatch.deadlineAt!).getTime());

  function openPicker(eventId: string, suggested: string[] | null) {
    setPickerOpenFor(eventId);
    setSelectedRegions(suggested ?? [...ALL_REGIONS]);
  }

  return (
    <div className="flex flex-col gap-[26px]">
      <h1 className="font-heading text-[32px] text-text">Command</h1>

      {/* Simulation status controls */}
      <section className="flex flex-wrap items-center gap-4 rounded-lg bg-surface p-5">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-700">Simulation Status</p>
          <p className="text-2xl font-bold capitalize text-text">{status.replace("_", " ")}</p>
        </div>
        <div className="ml-auto flex gap-2">
          {status !== "running" && (
            <PillButton tone="sage" onClick={() => setStatus.mutate("running")}>
              {status === "not_started" ? "Start Simulation" : "Resume"}
            </PillButton>
          )}
          {status === "running" && (
            <PillButton tone="accent" onClick={() => setStatus.mutate("paused")}>
              Pause
            </PillButton>
          )}
          {status !== "completed" && (
            <PillButton
              tone="ghost"
              onClick={() => {
                if (window.confirm("End the game now? This is reversible with Reopen, but every screen will switch to the summary report.")) {
                  setStatus.mutate("completed");
                }
              }}
            >
              End Game
            </PillButton>
          )}
          {status === "completed" && (
            <PillButton tone="accent" onClick={() => setStatus.mutate("running")}>
              Reopen
            </PillButton>
          )}
        </div>
      </section>

      <DirectorTimeline state={dash.globalState} events={data.events} dispatches={data.dispatches} />
      <TempoDial intensityMultiplier={dash.globalState.intensityMultiplier} />
      <InterjectionPanel />

      {/* Needs your attention */}
      <section className={`rounded-lg p-5 ${inboxCount > 0 ? "bg-accent-100" : "bg-surface"}`}>
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className={`text-xs uppercase tracking-wide ${inboxCount > 0 ? "text-accent-700" : "text-neutral-700"}`}>Needs Your Attention</p>
            <p className={`font-heading text-[21px] ${inboxCount > 0 ? "text-accent-900" : "text-text"}`}>
              {inboxCount === 0
                ? "Scoring inbox is empty — nothing waiting on you right now."
                : `${inboxCount} submission${inboxCount === 1 ? "" : "s"} awaiting scoring`}
            </p>
          </div>
          {inboxCount > 0 && (
            <div className="flex gap-6 text-sm text-accent-800">
              <span>Oldest: {Math.round(oldestMs / 60000)}m</span>
              {mandatoryCount > 0 && <span className="font-semibold">{mandatoryCount} mandatory review</span>}
            </div>
          )}
          {inboxCount > 0 && (
            <PillLink href="/scoring" tone="accent" className="ml-auto">
              Go to Scoring Inbox
            </PillLink>
          )}
        </div>
      </section>

      {/* Active deadlines — every currently-ticking countdown at once */}
      <section className="rounded-lg bg-surface p-5">
        <p className="mb-3 text-xs uppercase tracking-wide text-neutral-700">
          Active Deadlines {activeDeadlines.length > 0 && `(${activeDeadlines.length})`}
        </p>
        {activeDeadlines.length === 0 ? (
          <p className="text-sm text-neutral-700">Nothing awaiting a team response right now.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {activeDeadlines.map(({ dispatch, event }) => (
              <div key={dispatch.id} className="flex items-center justify-between gap-2 rounded-md bg-bg px-3 py-2 text-sm">
                <span className="truncate text-text">
                  {event!.title} {dispatch.targetTeamId ? `(${teamsByRegionId.get(dispatch.targetTeamId) ?? "?"})` : ""}
                </span>
                <DeadlineCountdown deadlineAt={dispatch.deadlineAt!} className="shrink-0 font-medium tabular-nums text-accent-700" />
              </div>
            ))}
          </div>
        )}
      </section>

      <EmergencyCommitteePanel />
      <BudgetCyclePanel />
      <MarketApprovalPanel />
      <EmergencyFundingPanel />

      {/* Event queue, grouped by day */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-[21px] text-text">Event Queue</h2>
          <div className="flex items-center gap-1.5 rounded-full bg-neutral-200 p-[5px] text-xs">
            <button
              onClick={() => setCoreOnly(false)}
              className={!coreOnly ? "rounded-full bg-bg px-4 py-1.5 font-bold text-text shadow-sm" : "rounded-full px-4 py-1.5 text-neutral-700"}
            >
              All 16 events
            </button>
            <button
              onClick={() => setCoreOnly(true)}
              className={coreOnly ? "rounded-full bg-bg px-4 py-1.5 font-bold text-text shadow-sm" : "rounded-full px-4 py-1.5 text-neutral-700"}
            >
              Core path only (~60min)
            </button>
          </div>
        </div>
        <div className="space-y-6">
          {[...eventsByGameDay.entries()].map(([gameDay, group]) => (
            <div key={gameDay}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-700">
                Game Day {gameDay} <span className="normal-case text-neutral-700">(narrative Day {group.narrativeDay})</span>
              </h3>
              <div className="space-y-3">
                {group.events.map((e) => {
                  const dispatches = data.dispatches.filter((d) => d.eventId === e.id);
                  const chain = data.chainStatus[e.id];
                  const allScored = dispatches.length > 0 && dispatches.every((d) => d.status === "scored" || d.status === "closed");

                  // For GLOBAL/MULTI events dispatched to every team, show a
                  // per-region checklist (not just a count) so the
                  // facilitator can call out exactly who hasn't responded
                  // while circulating the room.
                  const dispatchedRegions = new Map(
                    dispatches.filter((d) => d.targetTeamId != null).map((d) => [teamsByRegionId.get(d.targetTeamId!) ?? "?", d])
                  );
                  const showFullRegionChecklist = (e.scope === "GLOBAL" || e.scope === "MULTI") && dispatches.length > 1;
                  const isRestricted = !!e.suggestedTargetRegions && e.suggestedTargetRegions.length < ALL_REGIONS.length;
                  // Live-computed audience for adaptive events whose trigger
                  // names a region that can only be known from current game
                  // state (e.g. EVT-013's "any region's political tension >
                  // 70") — takes priority over the static suggestion below
                  // since it reflects what's actually true right now.
                  const targetHint = data.targetHints?.[e.id];
                  const pickerOpen = pickerOpenFor === e.id;

                  return (
                    <div key={e.id} className={`rounded-lg p-4 ${allScored ? "bg-accent-2-100" : "bg-surface"}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="flex flex-wrap items-center gap-2 font-semibold text-text">
                            {e.title} <span className="text-xs font-normal text-neutral-700">({e.id}, {e.scope})</span>
                            <Chip tone={e.isCorePath ? "accent-soft" : "neutral-soft"}>{e.isCorePath ? "Core" : "Optional"}</Chip>
                            {isRestricted && !targetHint && (
                              <Chip tone="neutral-soft">Targeted: {e.suggestedTargetRegions!.join("/")}</Chip>
                            )}
                            {targetHint && targetHint.length > 0 && (
                              <span title="Computed live from current game state">
                                <Chip tone="accent-soft">Currently qualifies: {targetHint.join("/")}</Chip>
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-xs text-neutral-700">{e.triggerConditionDesc}</p>
                          <p className="mt-2 max-w-xl text-xs text-neutral-700">{e.modelDeltaDesc}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <PillButton
                            size="sm"
                            tone="accent"
                            disabled={!chain?.ok}
                            onClick={() => (pickerOpen ? setPickerOpenFor(null) : openPicker(e.id, targetHint ?? e.suggestedTargetRegions))}
                            title={!chain?.ok ? `Blocked by: ${chain?.blockedBy.join(", ")}` : ""}
                          >
                            {dispatches.length > 0 ? "Re-dispatch" : "Dispatch Now"}
                          </PillButton>
                          {!chain?.ok && <span className="text-xs text-accent-700">Blocked: {chain.blockedBy.join(", ")}</span>}
                          {allScored && <span className="text-xs font-semibold text-accent-2-700">All scored</span>}
                        </div>
                      </div>

                      {pickerOpen && (
                        <div className="mt-3 space-y-2 rounded-lg bg-bg p-3">
                          <p className="text-xs text-neutral-700">
                            {targetHint && targetHint.length > 0
                              ? `Pre-filled with ${targetHint.join(", ")} — the region(s) that currently satisfy this event's trigger condition. Adjust if you want a different audience.`
                              : isRestricted
                                ? `The source design targets ${e.suggestedTargetRegions!.join(", ")} for this event — adjust if you want a different audience.`
                                : "Pick which regions receive this event."}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {ALL_REGIONS.map((r) => (
                              <label key={r} className="flex cursor-pointer items-center gap-1.5 rounded-full border-2 border-divider px-3 py-1 text-xs">
                                <input
                                  type="checkbox"
                                  checked={selectedRegions.includes(r)}
                                  onChange={(ev) =>
                                    setSelectedRegions(
                                      ev.target.checked ? [...selectedRegions, r] : selectedRegions.filter((x) => x !== r)
                                    )
                                  }
                                />
                                {r}
                              </label>
                            ))}
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => setSelectedRegions([...ALL_REGIONS])} className="text-xs font-medium text-accent-700 hover:text-accent-600">
                              Select all
                            </button>
                            <button onClick={() => setSelectedRegions([])} className="text-xs font-medium text-accent-700 hover:text-accent-600">
                              Clear
                            </button>
                            <PillButton
                              size="sm"
                              tone="sage"
                              disabled={selectedRegions.length === 0 || dispatchEvent.isPending}
                              onClick={() => dispatchEvent.mutate({ eventId: e.id, targetRegionIds: selectedRegions })}
                              className="ml-auto"
                            >
                              Confirm Dispatch to {selectedRegions.length || 0} region{selectedRegions.length === 1 ? "" : "s"}
                            </PillButton>
                          </div>
                        </div>
                      )}

                      {showFullRegionChecklist && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {allRegionIds.map((regionId) => {
                            const d = dispatchedRegions.get(regionId);
                            return (
                              <Chip key={regionId} tone={d ? statusChipTone[d.status] ?? "neutral-soft" : "neutral-outline"}>
                                {regionId}
                                {d?.revealedToPublic ? " ✓" : ""}
                              </Chip>
                            );
                          })}
                        </div>
                      )}

                      {dispatches.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {dispatches.map((d) => (
                            <div key={d.id} className="flex items-center gap-2 rounded-full bg-bg px-3 py-1 text-xs">
                              <span className="text-text">
                                #{d.id} {d.targetTeamId ? `(${teamsByRegionId.get(d.targetTeamId) ?? "?"})` : ""} · {d.status}
                              </span>
                              {d.status === "dispatched" && d.deadlineAt && <DeadlineCountdown deadlineAt={d.deadlineAt} className="text-accent-700 tabular-nums" />}
                              {!d.revealedToPublic && (
                                <button
                                  onClick={() => pushToGlobal.mutate({ dispatchId: d.id, headline: `${e.title} — now live` })}
                                  className="font-medium text-accent-700 hover:text-accent-600"
                                >
                                  Push to Global Display
                                </button>
                              )}
                              {d.revealedToPublic && <span className="text-accent-2-700">on display</span>}
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
