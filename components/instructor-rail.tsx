"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { computeSimClock, formatSimClock, formatRealElapsed, type GlobalClockFields } from "@/lib/sim-clock";
import { SignOutButton } from "@/components/signout-button";
import { RoleSwitcher } from "@/components/role-switcher";
import { OpenDisplayButton } from "@/components/open-display-button";
import { ResetSimulationButton } from "@/components/reset-simulation-button";

interface RailDashboardData {
  globalState: GlobalClockFields;
}

interface RailEventsData {
  events: { id: string; title: string }[];
  dispatches: { id: number; eventId: string; targetTeamId: number | null; status: string; deadlineAt: string | null }[];
  teams: { id: number; regionId: string }[];
}

interface InboxItem {
  decision: { id: number; submittedAt: string };
  mandatoryReview: boolean;
  ageMs: number;
}

const NAV_ITEMS = [
  { label: "Command", href: "/control" },
  { label: "Global", href: "/global" },
  { label: "Scoring", href: "/scoring" },
  { label: "Debrief", href: "/debrief" },
  { label: "Action log", href: "/log" },
  { label: "Guide", href: "/guide" },
];

export function InstructorRail({
  demoSession,
  active,
}: {
  demoSession: { sessionId: string; demoActiveRegionId: string | null } | null;
  active: { sessionId: string; mode: "instructor" | "demo"; displayToken: string } | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: dash } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<RailDashboardData>("/api/dashboard"),
    refetchInterval: 15000,
  });
  const { data: events } = useQuery({
    queryKey: ["events"],
    queryFn: () => apiFetch<RailEventsData>("/api/events"),
    refetchInterval: 15000,
  });
  const { data: inbox } = useQuery({
    queryKey: ["scoring-inbox"],
    queryFn: () => apiFetch<{ inbox: InboxItem[] }>("/api/scores"),
    refetchInterval: 15000,
  });

  const inboxCount = inbox?.inbox.length ?? 0;
  const mandatoryCount = inbox?.inbox.filter((i) => i.mandatoryReview).length ?? 0;
  const oldestMinutes = inbox?.inbox.length ? Math.round(Math.max(...inbox.inbox.map((i) => i.ageMs)) / 60000) : 0;

  const teamsByRegionId = new Map((events?.teams ?? []).map((t) => [t.id, t.regionId]));
  const activeDeadlines = (events?.dispatches ?? [])
    .filter((d) => d.status === "dispatched" && d.deadlineAt)
    .map((d) => ({ dispatch: d, event: events?.events.find((e) => e.id === d.eventId) }))
    .filter((x) => x.event)
    .sort((a, b) => new Date(a.dispatch.deadlineAt!).getTime() - new Date(b.dispatch.deadlineAt!).getTime())
    .slice(0, 5);

  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between gap-3 bg-neutral-900 px-4 py-3 lg:hidden">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">Veiled Horizon</p>
          <p className="font-heading text-lg text-white">Facilitator</p>
        </div>
        {inboxCount > 0 && <span className="text-xs font-bold text-accent-300">{inboxCount} waiting</span>}
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          className="rounded-full border-2 border-neutral-700 p-2 text-neutral-300"
        >
          <HamburgerIcon />
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button aria-label="Close navigation" className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[85vw] max-w-[320px] flex-col gap-[26px] overflow-y-auto bg-neutral-900 p-[22px]">
            <RailContents
              demoSession={demoSession}
              active={active}
              dash={dash}
              inboxCount={inboxCount}
              mandatoryCount={mandatoryCount}
              oldestMinutes={oldestMinutes}
              activeDeadlines={activeDeadlines}
              teamsByRegionId={teamsByRegionId}
              now={now}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      <aside className="sticky top-0 hidden h-screen w-[268px] shrink-0 flex-col gap-[26px] overflow-y-auto bg-neutral-900 px-[22px] py-[26px] lg:flex">
        <RailContents
          demoSession={demoSession}
          active={active}
          dash={dash}
          inboxCount={inboxCount}
          mandatoryCount={mandatoryCount}
          oldestMinutes={oldestMinutes}
          activeDeadlines={activeDeadlines}
          teamsByRegionId={teamsByRegionId}
          now={now}
          pathname={pathname}
        />
      </aside>
    </>
  );
}

function RailContents({
  demoSession,
  active,
  dash,
  inboxCount,
  mandatoryCount,
  oldestMinutes,
  activeDeadlines,
  teamsByRegionId,
  now,
  pathname,
  onNavigate,
}: {
  demoSession: { sessionId: string; demoActiveRegionId: string | null } | null;
  active: { sessionId: string; mode: "instructor" | "demo"; displayToken: string } | null;
  dash: RailDashboardData | undefined;
  inboxCount: number;
  mandatoryCount: number;
  oldestMinutes: number;
  activeDeadlines: { dispatch: RailEventsData["dispatches"][number]; event: RailEventsData["events"][number] | undefined }[];
  teamsByRegionId: Map<number, string>;
  now: number;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">Veiled Horizon</p>
        <p className="font-heading text-2xl leading-[1.15] text-white">Facilitator</p>
        {demoSession && (
          <div className="mt-2">
            <RoleSwitcher sessionId={demoSession.sessionId} currentRegionId={demoSession.demoActiveRegionId} />
          </div>
        )}
      </div>

      <div className="rounded-lg bg-accent-800 p-[16px_18px]">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent-300">Waiting on you</p>
        <p className="text-[34px] font-extrabold leading-none tracking-[-0.02em] text-white">{inboxCount}</p>
        <p className="mt-1 text-[13px] text-accent-200">
          submission{inboxCount === 1 ? "" : "s"}
          {inboxCount > 0 && ` · oldest ${oldestMinutes}m`}
          {mandatoryCount > 0 && ` · ${mandatoryCount} mandatory`}
        </p>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">Running deadlines</p>
        {activeDeadlines.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing awaiting a team response.</p>
        ) : (
          <div className="space-y-1.5">
            {activeDeadlines.map(({ dispatch, event }) => (
              <div key={dispatch.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-sm text-neutral-400">
                  {event?.title ?? dispatch.eventId}
                  {dispatch.targetTeamId ? ` · ${teamsByRegionId.get(dispatch.targetTeamId) ?? "?"}` : ""}
                </span>
                <span className="shrink-0 text-[13px] font-bold text-accent-300 tabular-nums">
                  <DeadlineValue deadlineAt={dispatch.deadlineAt!} now={now} />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <nav aria-label="Instructor navigation">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">Go to</p>
        <div className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "flex items-center justify-between rounded-full bg-accent-700 px-4 py-2 text-[15px] font-bold text-white"
                    : "flex items-center justify-between rounded-full px-4 py-2 text-[15px] text-neutral-300 transition-colors duration-150 hover:bg-neutral-800"
                }
              >
                {item.label}
                {item.label === "Scoring" && inboxCount > 0 && (
                  <span className="ml-2 rounded-full bg-accent-700 px-2 py-0.5 text-[12px] font-bold text-white">{inboxCount}</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="mt-auto border-t border-neutral-700 pt-[18px]">
        {dash?.globalState && <ClockBlock state={dash.globalState} now={now} />}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {active?.mode === "instructor" && (
            <Link href={`/sessions/${active.sessionId}/credentials`} className="text-sm text-neutral-400 hover:text-white">
              Login details
            </Link>
          )}
          <Link href="/sessions" className="text-sm text-neutral-400 hover:text-white">
            Switch mode
          </Link>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {active && <OpenDisplayButton displayToken={active.displayToken} label="Projector" />}
          <ResetSimulationButton />
        </div>
        <div className="mt-3">
          <SignOutButton />
        </div>
      </div>
    </>
  );
}

function ClockBlock({ state, now }: { state: GlobalClockFields; now: number }) {
  const clock = computeSimClock(state, now);
  return (
    <div title={`Real elapsed: ${formatRealElapsed(clock.realElapsedMs)}${clock.running ? "" : " (paused)"}`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">In-game</p>
      <p className="text-[18px] font-bold text-white">{formatSimClock(clock)}</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-neutral-700">
        <div className="h-full bg-accent-400" style={{ width: `${clock.gameDayFraction * 100}%` }} />
      </div>
    </div>
  );
}

function DeadlineValue({ deadlineAt, now }: { deadlineAt: string; now: number }) {
  const remainingMs = new Date(deadlineAt).getTime() - now;
  const expired = remainingMs <= 0;
  const minutes = Math.max(0, Math.floor(remainingMs / 60000));
  const seconds = Math.max(0, Math.floor((remainingMs % 60000) / 1000));
  if (expired) return <>Due</>;
  return (
    <>
      {minutes}:{String(seconds).padStart(2, "0")}
    </>
  );
}

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}
