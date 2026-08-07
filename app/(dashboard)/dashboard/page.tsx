"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { QueryError } from "@/components/query-error";
import { ProfileSections } from "@/components/profile-sections";
import { TeamSnapVoteBanner } from "@/components/snap-vote-banner";
import { BudgetCycleBanner } from "@/components/budget-cycle-banner";
import { RecentDevelopments } from "@/components/recent-developments";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Chip } from "@/components/ui/chip";
import { PillLink } from "@/components/ui/pill-button";

interface DashboardData {
  globalState: { currentDay: number; escalationState: "GREEN" | "AMBER" | "RED"; mediaPressureIndex: number; simulationStatus: string };
  globalRt: number;
  sharedSummary: {
    regionId: string;
    fullName: string;
    confirmedCases: number;
    estimatedTrueCasesLow: number;
    estimatedTrueCasesHigh: number;
    deaths: number;
    rt: number;
    hospitalCapacityPct: number;
    surveillanceIndex: number;
  }[];
  ownRegion: {
    regionId: string;
    day: number;
    rt: number;
    cfrMultiplier: number;
    fundRemaining: number;
    ppeDaysRemaining: number;
    antiviralsRemaining: number;
    hcwSurgePct: number;
    politicalTensionIndex: number;
    publicTrustIndex: number;
    populationHappinessIndex: number;
    profileMarkdown: string;
    roleTitle: string;
    hqLocation: string;
    projection: {
      points: { narrativeDay: number; confirmedCases: number; deaths: number }[];
      assumedRt: number;
      narrative: string;
    };
  } | null;
  notifications: { id: number; kind: string; message: string; createdAt: string }[];
  globalAvgHappiness: number;
  globalAvgPublicTrust: number;
  ghostPreview: { worldDeathsPrevented: number; worldInfectionsPrevented: number } | null;
}

interface EventsData {
  events: { id: string; title: string; deadlineType: string }[];
  dispatches: { id: number; eventId: string; status: string; deadlineAt: string | null }[];
}

const escalationTone: Record<string, string> = {
  GREEN: "bg-neutral-800",
  AMBER: "bg-accent-700",
  RED: "bg-accent-900",
};

const VIEWS = [
  { value: "overview", label: "Overview" },
  { value: "regions", label: "All regions" },
  { value: "projection", label: "Projection" },
  { value: "recent", label: "Recent developments" },
] as const;
type View = (typeof VIEWS)[number]["value"];

export default function DashboardPage() {
  const [view, setView] = useState<View>("overview");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardData>("/api/dashboard"),
    refetchInterval: 15000,
  });
  const { data: events } = useQuery({
    queryKey: ["events"],
    queryFn: () => apiFetch<EventsData>("/api/events"),
    refetchInterval: 15000,
  });

  if (error) return <QueryError error={error} onRetry={() => refetch()} label="situation room" />;
  if (isLoading || !data) return <p className="text-neutral-600">Loading situation room...</p>;

  const openDispatch = (events?.dispatches ?? []).find((d) => d.status === "dispatched");
  const openEvent = openDispatch ? events?.events.find((e) => e.id === openDispatch.eventId) : null;

  const ownSummary = data.ownRegion ? data.sharedSummary.find((r) => r.regionId === data.ownRegion!.regionId) : undefined;

  return (
    <div className="flex flex-col gap-[26px]">
      <TeamSnapVoteBanner />
      <BudgetCycleBanner />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-[32px] text-text">Situation</h1>
        <div className="flex flex-wrap items-center gap-4">
          <Chip tone="accent-solid" className={escalationTone[data.globalState.escalationState]}>
            {data.globalState.escalationState.charAt(0) + data.globalState.escalationState.slice(1).toLowerCase()}
          </Chip>
          <span className="text-[15px] text-neutral-700">
            Global Rt <span className="font-bold text-text">{data.globalRt.toFixed(2)}</span>
          </span>
          <span className="text-[15px] text-neutral-700">
            Media <span className="font-bold text-text">{data.globalState.mediaPressureIndex}</span>
          </span>
        </div>
      </div>
      <p className="-mt-4 text-xs text-neutral-600">
        Rt drifts upward slowly on its own while the sim is running and no fresh containment decision has landed — idle time has a cost too.
      </p>

      <SegmentedControl options={VIEWS as unknown as { value: View; label: string }[]} value={view} onChange={setView} />

      {view === "overview" && (
        <>
          {openDispatch && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg bg-accent-100 p-[22px_24px]">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-accent-700">Open decision</p>
                <p className="font-heading text-[21px] text-accent-900">{openEvent?.title ?? openDispatch.eventId}</p>
                <p className="mt-1 text-sm text-accent-800">{openEvent?.deadlineType ?? "scheduled"} deadline — your response shapes the shared record.</p>
              </div>
              <PillLink href={`/events/${openDispatch.id}`} tone="accent">
                Respond
              </PillLink>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {ownSummary && <VisibilityGapCard summary={ownSummary} />}
            {data.ownRegion && <ProjectionCard projection={data.ownRegion.projection} />}
          </div>

          {data.ownRegion && (
            <section className="rounded-lg bg-surface p-5">
              <h2 className="font-heading text-[21px] text-text">{data.ownRegion.roleTitle}</h2>
              <p className="mb-4 text-sm text-neutral-700">{data.ownRegion.hqLocation}</p>
              <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Stat label="Fund" value={`$${(data.ownRegion.fundRemaining / 1_000_000).toFixed(1)}M`} />
                <Stat label="PPE days" value={data.ownRegion.ppeDaysRemaining} />
                <Stat label="Antivirals" value={data.ownRegion.antiviralsRemaining.toLocaleString()} />
                <Stat label="HCW surge" value={`${data.ownRegion.hcwSurgePct}%`} />
                <Stat label="Rt" value={data.ownRegion.rt.toFixed(2)} />
                <Stat label="CFR multiplier" value={data.ownRegion.cfrMultiplier.toFixed(2)} />
                <Stat label="Political tension" value={data.ownRegion.politicalTensionIndex} />
                <Stat label="Public trust" value={data.ownRegion.publicTrustIndex} />
                <Stat label="Population happiness" value={data.ownRegion.populationHappinessIndex} />
              </div>
              <details className="text-sm text-neutral-800">
                <summary className="cursor-pointer text-neutral-600">Full regional profile</summary>
                <div className="mt-3">
                  <ProfileSections markdown={data.ownRegion.profileMarkdown} />
                </div>
              </details>
            </section>
          )}
        </>
      )}

      {view === "regions" && <RegionsTable rows={data.sharedSummary} ownRegionId={data.ownRegion?.regionId} />}

      {view === "projection" && data.ownRegion && <ProjectionCard projection={data.ownRegion.projection} full />}

      {view === "recent" && (
        <>
          {data.notifications.length > 0 ? (
            <RecentDevelopments notifications={data.notifications} />
          ) : (
            <p className="text-sm text-neutral-600">Nothing new yet.</p>
          )}
          {data.ghostPreview && <CounterfactualGhost ghostPreview={data.ghostPreview} />}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-bg p-3">
      <p className="text-xs text-neutral-600">{label}</p>
      <p className="text-base font-bold text-text">{value}</p>
    </div>
  );
}

// The clearest teaching moment in the app: how much of the region's true
// caseload is actually visible in confirmed testing data. Two nested bars —
// the outer one is the estimated-true range, the inner (narrower) one is
// what's actually confirmed — so the gap between them is the point.
function VisibilityGapCard({
  summary,
}: {
  summary: { confirmedCases: number; estimatedTrueCasesLow: number; estimatedTrueCasesHigh: number };
}) {
  const pct = summary.estimatedTrueCasesHigh > 0 ? Math.min(100, (summary.confirmedCases / summary.estimatedTrueCasesHigh) * 100) : 0;
  return (
    <section className="rounded-lg bg-surface p-5">
      <h2 className="font-heading text-[21px] text-text">Your visibility gap</h2>
      <div className="relative mt-4 h-[26px] overflow-hidden rounded-full bg-accent-200">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-out motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-neutral-600">
        <span>
          confirmed: <span className="font-bold text-text">{summary.confirmedCases.toLocaleString()}</span>
        </span>
        <span>
          estimated true: <span className="font-bold text-text">{summary.estimatedTrueCasesLow.toLocaleString()}–{summary.estimatedTrueCasesHigh.toLocaleString()}</span>
        </span>
      </div>
    </section>
  );
}

// Item 5: a private forward projection ("if nothing changes...") using the
// live growth model held at the team's current Rt — never shown to other
// regions, and never a hint about what to actually do about it.
function ProjectionCard({
  projection,
  full = false,
}: {
  projection: { points: { narrativeDay: number; confirmedCases: number; deaths: number }[]; assumedRt: number; narrative: string };
  full?: boolean;
}) {
  return (
    <section className="rounded-lg bg-accent-2-100 p-5">
      <h2 className="font-heading text-[21px] text-accent-2-900">If nothing changes</h2>
      <p className="mb-4 text-sm text-accent-2-800">{projection.narrative}</p>
      <div className={`grid grid-cols-1 gap-3 ${full ? "sm:grid-cols-3" : "sm:grid-cols-3"}`}>
        {projection.points.map((p) => (
          <div key={p.narrativeDay} className="rounded-md bg-bg p-3">
            <p className="text-xs text-neutral-600">{p.narrativeDay === 0 ? "Now" : `+${p.narrativeDay}d`}</p>
            <p className="mt-1 text-[24px] font-bold text-accent-2-900">{p.confirmedCases.toLocaleString()}</p>
            <p className="text-xs text-neutral-600">confirmed</p>
            {p.narrativeDay > 0 && (
              <p className="mt-0.5 text-sm font-bold text-accent-2-800">
                +{p.deaths.toLocaleString()} <span className="text-xs font-normal text-neutral-600">projected deaths</span>
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-accent-2-700">
        Private to your region only. Assumes your current Rt ({projection.assumedRt.toFixed(2)}) holds steady — a real decision will move it.
      </p>
    </section>
  );
}

function RegionsTable({
  rows,
  ownRegionId,
}: {
  rows: { regionId: string; confirmedCases: number; deaths: number; rt: number; hospitalCapacityPct: number; surveillanceIndex: number }[];
  ownRegionId?: string;
}) {
  return (
    <section className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-divider text-left text-[12px] font-medium text-neutral-600">
            <th className="py-[7px] pr-[10px]">Region</th>
            <th className="py-[7px] pr-[10px]">Confirmed</th>
            <th className="py-[7px] pr-[10px]">Deaths</th>
            <th className="py-[7px] pr-[10px]">Rt</th>
            <th className="py-[7px] pr-[10px]">Capacity</th>
            <th className="py-[7px] pr-[10px]">Surv</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const own = r.regionId === ownRegionId;
            return (
              <tr key={r.regionId} className={`border-b border-divider ${own ? "bg-accent-2-100" : ""}`}>
                <td className={`py-[9px] pr-[10px] ${own ? "font-bold" : "font-medium"}`}>{r.regionId}</td>
                <td className="py-[9px] pr-[10px]">{r.confirmedCases}</td>
                <td className="py-[9px] pr-[10px]">{r.deaths}</td>
                <td className={`py-[9px] pr-[10px] ${own ? "font-bold text-accent-700" : ""}`}>{r.rt.toFixed(2)}</td>
                <td className="py-[9px] pr-[10px]">{r.hospitalCapacityPct}%</td>
                <td className="py-[9px] pr-[10px]">{r.surveillanceIndex}/10</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

// Item 14: a deliberately blurred glimpse of the world-level optimal-shadow
// comparison, surfaced only in the session's final stretch. The number is
// real (not a rounded-off range) but rendered illegible by design — the
// point is "a real number exists and it's worse than it should be," not
// giving away the debrief early.
function CounterfactualGhost({ ghostPreview }: { ghostPreview: { worldDeathsPrevented: number; worldInfectionsPrevented: number } }) {
  return (
    <section className="relative overflow-hidden rounded-lg bg-neutral-900 p-6">
      <p className="mb-2 text-xs uppercase tracking-widest text-neutral-500">A Question for Later</p>
      <p className="mb-3 text-sm text-neutral-400">
        Somewhere in this session&apos;s data is a number for how many deaths, worldwide, an ideal response would have
        prevented by now. It will be fully revealed at the debrief.
      </p>
      <div className="flex items-baseline gap-3 select-none" aria-hidden>
        <span className="text-4xl font-bold text-accent-700" style={{ filter: "blur(6px)" }}>
          {ghostPreview.worldDeathsPrevented.toLocaleString()}
        </span>
        <span className="text-sm text-neutral-500">deaths preventable, world-wide, right now</span>
      </div>
    </section>
  );
}
