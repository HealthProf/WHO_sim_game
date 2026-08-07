"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { computeSimClock, formatSimClock, formatRealElapsed, type GlobalClockFields } from "@/lib/sim-clock";
import { SignOutButton } from "@/components/signout-button";
import { RoleSwitcher } from "@/components/role-switcher";
import { affordabilityIssue, type OwnRegionResources } from "@/lib/affordability";
import type { StructuredOption, OptionCost } from "@/lib/db/seed-data/events";

interface RailDashboardData {
  globalState: GlobalClockFields;
  ownRegion: {
    regionId: string;
    rt: number;
    fundRemaining: number;
    ppeDaysRemaining: number;
    antiviralsRemaining: number;
    hcwSurgePct: number;
    politicalTensionIndex: number;
    publicTrustIndex: number;
  } | null;
}

interface RailEventsData {
  events: { id: string; title: string; structuredOptionsJson: Pick<StructuredOption, "label" | "cost">[] | null }[];
  dispatches: { id: number; eventId: string; status: string; deadlineAt: string | null }[];
}

const COST_LABEL: Record<keyof OptionCost, string> = {
  fund: "Fund",
  ppeDays: "PPE days",
  antivirals: "Antivirals",
};

const NAV_ITEMS = [
  { label: "Situation", href: "/dashboard" },
  { label: "Events", href: "/events" },
  { label: "Coordination", href: "/coordination" },
  { label: "Pledges", href: "/pledges" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "Funding", href: "/emergency-funding" },
  { label: "Briefing", href: "/briefing" },
  { label: "Summary", href: "/summary" },
];

const ROSE_WINDOW_MS = 30_000;

export function TeamRail({
  regionId,
  demoSession,
}: {
  regionId: string | null | undefined;
  demoSession: { sessionId: string; demoActiveRegionId: string | null } | null;
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

  const prevRt = useRef<number | null>(null);
  const [roseUntil, setRoseUntil] = useState(0);
  useEffect(() => {
    const rt = dash?.ownRegion?.rt;
    if (rt == null) return;
    if (prevRt.current != null && rt > prevRt.current) {
      setRoseUntil(Date.now() + ROSE_WINDOW_MS);
    }
    prevRt.current = rt;
  }, [dash?.ownRegion?.rt]);
  const rtRose = now < roseUntil;

  const openDispatch = (events?.dispatches ?? [])
    .filter((d) => d.status === "dispatched" && d.deadlineAt && new Date(d.deadlineAt).getTime() > now)
    .sort((a, b) => new Date(a.deadlineAt!).getTime() - new Date(b.deadlineAt!).getTime())[0];
  const openEvent = openDispatch ? events?.events.find((e) => e.id === openDispatch.eventId) : null;
  const awaitingCount = (events?.dispatches ?? []).filter((d) => d.status === "dispatched").length;

  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const eventRouteMatch = pathname.match(/^\/events\/(\d+)/);
  const viewingDispatch = eventRouteMatch ? (events?.dispatches ?? []).find((d) => d.id === Number(eventRouteMatch[1])) : undefined;
  const viewingEvent = viewingDispatch ? events?.events.find((e) => e.id === viewingDispatch.eventId) : undefined;

  return (
    <>
      {/* Mobile top bar (<1024px) */}
      <div className="flex items-center justify-between gap-3 bg-neutral-900 px-4 py-3 lg:hidden">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">Veiled Horizon</p>
          <p className="font-heading text-lg text-white">{regionId ?? "Region"}</p>
        </div>
        {openDispatch && (
          <span className="text-xs font-bold text-accent-300">
            <DeadlineValue deadlineAt={openDispatch.deadlineAt!} now={now} compact />
          </span>
        )}
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
              regionId={regionId}
              demoSession={demoSession}
              dash={dash}
              openDispatch={openDispatch}
              openEvent={openEvent}
              now={now}
              rtRose={rtRose}
              pathname={pathname}
              awaitingCount={awaitingCount}
              viewingEvent={viewingEvent}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Desktop rail (>=1024px) */}
      <aside className="sticky top-0 hidden h-screen w-[268px] shrink-0 flex-col gap-[26px] overflow-y-auto bg-neutral-900 px-[22px] py-[26px] lg:flex">
        <RailContents
          regionId={regionId}
          demoSession={demoSession}
          dash={dash}
          openDispatch={openDispatch}
          openEvent={openEvent}
          now={now}
          rtRose={rtRose}
          pathname={pathname}
          awaitingCount={awaitingCount}
          viewingEvent={viewingEvent}
        />
      </aside>
    </>
  );
}

function RailContents({
  regionId,
  demoSession,
  dash,
  openDispatch,
  openEvent,
  now,
  rtRose,
  pathname,
  awaitingCount,
  viewingEvent,
  onNavigate,
}: {
  regionId: string | null | undefined;
  demoSession: { sessionId: string; demoActiveRegionId: string | null } | null;
  dash: RailDashboardData | undefined;
  openDispatch: RailEventsData["dispatches"][number] | undefined;
  openEvent: RailEventsData["events"][number] | null | undefined;
  now: number;
  rtRose: boolean;
  pathname: string;
  awaitingCount: number;
  viewingEvent: RailEventsData["events"][number] | undefined;
  onNavigate?: () => void;
}) {
  return (
    <>
      {/* Brand block */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">Veiled Horizon</p>
        <p className="font-heading text-2xl leading-[1.15] text-white">
          {regionId ?? "—"}
          <br />
          Regional Office
        </p>
        {demoSession && (
          <div className="mt-2">
            <RoleSwitcher sessionId={demoSession.sessionId} currentRegionId={demoSession.demoActiveRegionId} />
          </div>
        )}
      </div>

      {/* Deadline block */}
      {openDispatch && (
        <div className="rounded-lg bg-accent-800 p-[16px_18px]">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent-300">Deadline</p>
          <p className="text-[34px] font-extrabold leading-none tracking-[-0.02em] text-white">
            <DeadlineValue deadlineAt={openDispatch.deadlineAt!} now={now} />
          </p>
          <p className="mt-1 truncate text-[13px] text-accent-200">{openEvent?.title ?? openDispatch.eventId}</p>
        </div>
      )}

      {/* Ledger, or — on an event's own page — the affordability block */}
      {viewingEvent ? (
        <AffordabilityBlock event={viewingEvent} resources={dash?.ownRegion ?? undefined} />
      ) : (
        dash?.ownRegion && (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">Your ledger</p>
            <div className="space-y-1.5">
              <LedgerRow label="Fund" value={`$${(dash.ownRegion.fundRemaining / 1_000_000).toFixed(1)}M`} />
              <LedgerRow label="PPE days" value={dash.ownRegion.ppeDaysRemaining} />
              <LedgerRow label="Antivirals" value={dash.ownRegion.antiviralsRemaining.toLocaleString()} />
              <LedgerRow label="HCW surge" value={`${dash.ownRegion.hcwSurgePct}%`} />
              <div className="my-1.5 h-px bg-neutral-700" />
              <LedgerRow
                label="Your Rt"
                value={
                  <span className={rtRose ? "text-accent-300" : undefined}>
                    {dash.ownRegion.rt.toFixed(2)}
                    {rtRose && " ↑"}
                  </span>
                }
              />
              <LedgerRow label="Trust" value={dash.ownRegion.publicTrustIndex} />
              <LedgerRow label="Tension" value={dash.ownRegion.politicalTensionIndex} />
            </div>
          </div>
        )
      )}

      {/* Nav */}
      <nav aria-label="Team navigation">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">Go to</p>
        <div className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "flex items-center justify-between rounded-full bg-accent-700 px-4 py-2 text-[15px] font-bold text-white"
                    : "flex items-center justify-between rounded-full px-4 py-2 text-[15px] text-neutral-300 transition-colors duration-150 hover:bg-neutral-800"
                }
              >
                {item.label}
                {item.label === "Events" && awaitingCount > 0 && (
                  <span className="ml-2 rounded-full bg-accent-500 px-2 py-0.5 text-[12px] font-bold text-white">{awaitingCount}</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Clock, pushed to the bottom */}
      <div className="mt-auto border-t border-neutral-700 pt-[18px]">
        {dash?.globalState && <ClockBlock state={dash.globalState} now={now} />}
        <div className="mt-3">
          <SignOutButton />
        </div>
      </div>
    </>
  );
}

// The rail's event-scoped replacement for the ledger: the resources this
// event's options actually cost, plus which option (if any) the team can't
// currently afford — computed with the same affordabilityIssue() rule the
// event page itself uses to gate option selection.
function AffordabilityBlock({
  event,
  resources,
}: {
  event: RailEventsData["events"][number];
  resources: OwnRegionResources | undefined;
}) {
  const options = event.structuredOptionsJson ?? [];
  const costKeys = Array.from(
    new Set(options.flatMap((o) => (o.cost ? (Object.keys(o.cost) as (keyof OptionCost)[]) : [])))
  );
  if (costKeys.length === 0 || !resources) return null;

  const blocked = options.find((o) => affordabilityIssue(o.cost, resources));
  const shortfall = blocked ? affordabilityIssue(blocked.cost, resources) : null;

  const resourceValue: Record<keyof OptionCost, string> = {
    fund: `$${(resources.fundRemaining / 1_000_000).toFixed(1)}M`,
    ppeDays: `${resources.ppeDaysRemaining}`,
    antivirals: resources.antiviralsRemaining.toLocaleString(),
  };

  return (
    <div>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">Can you afford it?</p>
      <div className="space-y-1.5">
        {costKeys.map((key) => (
          <LedgerRow key={key} label={COST_LABEL[key]} value={resourceValue[key]} />
        ))}
      </div>
      {shortfall && (
        <p className="mt-2 text-[13px] text-accent-300">
          Option {blocked!.label} — {shortfall}
        </p>
      )}
    </div>
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

function LedgerRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-neutral-400">{label}</span>
      <span className="text-[17px] font-bold text-white">{value}</span>
    </div>
  );
}

function DeadlineValue({ deadlineAt, now, compact }: { deadlineAt: string; now: number; compact?: boolean }) {
  const remainingMs = new Date(deadlineAt).getTime() - now;
  const expired = remainingMs <= 0;
  const minutes = Math.max(0, Math.floor(remainingMs / 60000));
  const seconds = Math.max(0, Math.floor((remainingMs % 60000) / 1000));
  if (expired) return <>{compact ? "Due" : "Deadline passed"}</>;
  return (
    <>
      {minutes}m {String(seconds).padStart(2, "0")}s
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
