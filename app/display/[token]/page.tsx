"use client";

import { useEffect, useRef, useState } from "react";
import { regionColors } from "@/lib/who-region-map";
import { SimClock } from "@/components/sim-clock";
import type { GlobalClockFields } from "@/lib/sim-clock";
import { SummaryReportViewer } from "@/components/summary-report-viewer";
import type { SummaryRound } from "@/lib/summary-report";
import type { FinalResults } from "@/lib/final-results";
import type { TeamChapter as FullTeamChapter } from "@/lib/team-chapter";

interface DisplaySnapVote {
  question: string;
  options: string[];
  closesAt: string;
  respondedCount: number;
  totalTeams: number;
}

interface DisplayAnnouncement {
  id: number;
  kind: string;
  title: string;
  message: string;
  autoDismissSeconds: number | null;
  createdAt: string;
}

type TeamChapter = Pick<FullTeamChapter, "regionId" | "headline" | "narrative" | "tierCounts" | "deathsPrevented">;

interface DisplayData extends GlobalClockFields {
  currentDay: number;
  escalationState: "GREEN" | "AMBER" | "RED";
  mediaPressureIndex: number;
  simulationStatus: string;
  globalRt: number;
  regions: { regionId: string; fullName: string; confirmedCases: number; deaths: number; rt: number }[];
  feedItems: { id: number; text: string; createdAt: string }[];
  rounds: SummaryRound[] | null;
  snapVote: DisplaySnapVote | null;
  activeDeadlines: { eventTitle: string; deadlineAt: string }[];
  activeAnnouncement: DisplayAnnouncement | null;
  totalConfirmed: number;
  totalDeaths: number;
  globalAvgHappiness: number;
  globalAvgPublicTrust: number;
  finalResults: FinalResults | null;
  teamChapters: TeamChapter[] | null;
  worldHealth: { index: number; label: string };
}

const escalationBg: Record<string, string> = {
  GREEN: "bg-emerald-700",
  AMBER: "bg-amber-600",
  RED: "bg-red-700",
};

export default function PublicDisplayPage() {
  const [data, setData] = useState<DisplayData | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Tracks when *this browser* first observed the current announcement, not
  // its server createdAt — the popup is shown for a fixed duration from
  // there, so a slow poll cycle can never cause it to be missed or cut
  // short (see lib/announcements.ts getActiveGlobalAnnouncement).
  const [announcementSeen, setAnnouncementSeen] = useState<{ id: number; seenAt: number } | null>(null);

  // Item 6's live feed: newest on top, and a new item stays visibly
  // highlighted for a while after it first appears rather than blending
  // straight into the list. Arrival time is tracked client-side (0 = "was
  // already here at page load, don't flash it") so a slow poll cycle can't
  // make an old item look new. Kept in state (not a ref) since it's read
  // during render — refs may only be read from effects/handlers.
  const [arrivalMap, setArrivalMap] = useState<Record<number, number>>({});
  const feedInitializedRef = useRef(false);
  useEffect(() => {
    if (!data) return;
    setArrivalMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const item of data.feedItems) {
        if (!(item.id in next)) {
          next[item.id] = feedInitializedRef.current ? Date.now() : 0;
          changed = true;
        }
      }
      feedInitializedRef.current = true;
      return changed ? next : prev;
    });
  }, [data]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        const res = await fetch("/api/display", { cache: "no-store" });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const json = await res.json();
        if (!active) return;
        setData(json);
        setLastError(null);
        setLastSuccessAt(Date.now());
        const incoming = json.activeAnnouncement as DisplayAnnouncement | null;
        if (incoming) {
          setAnnouncementSeen((prev) => (prev?.id === incoming.id ? prev : { id: incoming.id, seenAt: Date.now() }));
        }
      } catch (err) {
        if (!active) return;
        setLastError(err instanceof Error ? err.message : "Failed to reach the server");
      }
    }
    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // Never gets permanently stuck: if we have no data yet and the last
  // attempt failed, show a visible error with an automatic retry countdown
  // instead of an indefinite "Loading..." screen.
  if (!data) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-slate-400 text-3xl text-center px-8">
        <p>{lastError ? "Couldn't reach the server" : "Loading situation room..."}</p>
        {lastError && <p className="text-lg text-red-400">{lastError} — retrying every 10s</p>}
      </div>
    );
  }

  // Data is stale if the last successful poll was more than ~40s ago
  // (four missed cycles) — surface it rather than silently showing old
  // numbers forever if the connection has actually dropped.
  const isStale = lastSuccessAt !== null && now - lastSuccessAt > 40000;

  const staleBanner = isStale && (
    <div className="shrink-0 bg-red-900 text-white text-center py-1.5 text-sm font-medium">
      Connection to the server may be lost — last updated {Math.round((now - lastSuccessAt!) / 1000)}s ago, still retrying
    </div>
  );

  if (data.simulationStatus === "completed" && data.rounds) {
    return (
      <div className="h-screen w-screen bg-slate-950 text-white flex flex-col overflow-hidden">
        {staleBanner}
        <header className="shrink-0 px-8 py-6 bg-slate-800 text-center">
          <h1 className="text-4xl xl:text-5xl font-bold tracking-wide">SIMULATION COMPLETE — SUMMARY REPORT</h1>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto p-8 space-y-8">
          {data.finalResults && (
            <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
              <h2 className="text-2xl font-bold">Final Results: Actual vs. Ideal Playthrough</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatTile label="Actual Confirmed" value={data.finalResults.totalActualConfirmed.toLocaleString()} />
                <StatTile label="Actual Deaths" value={data.finalResults.totalActualDeaths.toLocaleString()} />
                <StatTile label="Ideal Confirmed" value={data.finalResults.totalOptimalConfirmed.toLocaleString()} />
                <StatTile label="Ideal Deaths" value={data.finalResults.totalOptimalDeaths.toLocaleString()} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-amber-950/40 border border-amber-700 rounded-lg p-4">
                  <p className="text-sm uppercase tracking-wide text-amber-300">Infections Preventable</p>
                  <p className="text-4xl font-bold mt-1">{data.finalResults.totalInfectionsPrevented.toLocaleString()}</p>
                </div>
                <div className="bg-red-950/40 border border-red-700 rounded-lg p-4">
                  <p className="text-sm uppercase tracking-wide text-red-300">Deaths Preventable</p>
                  <p className="text-4xl font-bold mt-1">{data.finalResults.totalDeathsPrevented.toLocaleString()}</p>
                </div>
              </div>
            </section>
          )}
          {data.teamChapters && data.teamChapters.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Chapters of History</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.teamChapters.map((c) => (
                  <div key={c.regionId} className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-xl p-5 space-y-2">
                    <p className="text-xl font-bold text-white">{c.headline}</p>
                    <p className="text-sm text-slate-300">{c.narrative}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
          <SummaryReportViewer rounds={data.rounds} large />
        </div>
      </div>
    );
  }

  const maxCases = Math.max(...data.regions.map((r) => r.confirmedCases), 1);
  const maxDeaths = Math.max(...data.regions.map((r) => r.deaths), 1);
  const maxRt = Math.max(...data.regions.map((r) => r.rt), 1);
  const sortedRegionsByCases = [...data.regions].sort((a, b) => b.confirmedCases - a.confirmedCases);

  return (
    <div className="h-screen w-screen bg-slate-950 text-white flex flex-col overflow-hidden">
      {staleBanner}
      <header className={`shrink-0 px-8 py-5 flex flex-wrap items-center justify-between gap-4 ${escalationBg[data.escalationState]}`}>
        <h1 className="text-3xl xl:text-4xl font-bold tracking-wide">OPERATION VEILED HORIZON</h1>
        <SimClock state={data} size="lg" />
        <div className="flex items-center gap-8 text-xl xl:text-2xl font-semibold">
          <span>{data.escalationState}</span>
          <span>Global Rt {data.globalRt.toFixed(2)}</span>
          <span>Media Pressure {data.mediaPressureIndex}</span>
        </div>
      </header>

      {/* Item 12's "single world health bar" — one shared composite number
          (see lib/world-health.ts) the whole room watches together, instead
          of six regions' worth of stats competing for attention. Color
          bands green->amber->red across the fill, with the index and its
          descriptor as a direct label rather than color alone. */}
      <div className="shrink-0 bg-slate-900 border-b border-slate-800 px-8 py-3 flex items-center gap-4">
        <span className="text-xs uppercase tracking-widest text-slate-400 shrink-0">World Health</span>
        <div className="flex-1 h-4 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              data.worldHealth.index >= 55 ? "bg-emerald-500" : data.worldHealth.index >= 35 ? "bg-amber-500" : "bg-red-600"
            }`}
            style={{ width: `${Math.max(3, data.worldHealth.index)}%` }}
          />
        </div>
        <span className="text-lg font-bold tabular-nums shrink-0">{data.worldHealth.index}/100</span>
        <span className="text-sm text-slate-400 shrink-0 w-32">{data.worldHealth.label}</span>
      </div>

      {data.snapVote && (
        <div className="shrink-0 bg-red-800 px-8 py-4 flex items-center justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-wide text-red-200 font-semibold">Emergency Committee — Snap Vote</p>
            <p className="text-xl xl:text-2xl font-bold text-white">{data.snapVote.question}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-3xl xl:text-4xl font-bold tabular-nums text-white">
              {Math.max(0, Math.ceil((new Date(data.snapVote.closesAt).getTime() - now) / 1000))}s
            </p>
            <p className="text-sm text-red-200">{data.snapVote.respondedCount}/{data.snapVote.totalTeams} regions responded</p>
          </div>
        </div>
      )}

      {data.activeDeadlines.length > 0 && (
        <div className="shrink-0 bg-slate-900 border-b border-slate-800 px-8 py-2 flex items-center gap-6 overflow-x-auto">
          <span className="text-xs uppercase tracking-wide text-slate-500 shrink-0">Active Deadlines</span>
          {data.activeDeadlines.map((d) => {
            const remainingMs = Math.max(0, new Date(d.deadlineAt).getTime() - now);
            const minutes = Math.floor(remainingMs / 60000);
            const seconds = Math.floor((remainingMs % 60000) / 1000);
            return (
              <span key={d.eventTitle} className="text-sm text-slate-300 shrink-0 whitespace-nowrap">
                {d.eventTitle}: <span className="text-amber-400 font-semibold tabular-nums">{minutes}m {String(seconds).padStart(2, "0")}s</span>
              </span>
            );
          })}
        </div>
      )}

      {data.activeAnnouncement &&
        announcementSeen?.id === data.activeAnnouncement.id &&
        now - announcementSeen.seenAt < (data.activeAnnouncement.autoDismissSeconds ?? 10) * 1000 &&
        (data.activeAnnouncement.kind === "dramatic_moment" ? (
          // Item 2's scripted midpoint moment: a full black takeover, not
          // an overlay — no map, no feed, nothing competing for attention.
          // Text fades in slowly rather than popping, so the room has a
          // beat of silence before it can read anything.
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black px-16">
            <div className="max-w-5xl w-full text-center animate-fade-in-slow">
              <p className="text-sm uppercase tracking-[0.3em] text-red-500 font-semibold mb-6">{data.activeAnnouncement.title}</p>
              <p className="text-4xl xl:text-6xl font-bold text-white leading-snug">{data.activeAnnouncement.message}</p>
            </div>
          </div>
        ) : (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-12 pointer-events-none">
            <div className="max-w-4xl w-full rounded-2xl border-4 border-blue-500 bg-blue-950 p-10 text-center shadow-2xl">
              <p className="text-lg uppercase tracking-widest text-blue-300 font-semibold mb-3">{data.activeAnnouncement.title}</p>
              <p className="text-3xl xl:text-4xl font-bold text-white leading-snug">{data.activeAnnouncement.message}</p>
            </div>
          </div>
        ))}

      <div className="flex-1 min-h-0 flex gap-0">
        {/* Left: real-time key metrics — stat tiles plus a bar per region for
            each of confirmed cases, deaths, and Rt. Bars carry a direct
            region-code + value label rather than relying on color alone to
            tell regions apart (the brand palette fails a strict CVD check at
            6 hues — see dataviz skill palette validation). */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
            <StatTile label="Total Confirmed" value={data.totalConfirmed.toLocaleString()} />
            <StatTile label="Total Deaths" value={data.totalDeaths.toLocaleString()} />
            <StatTile label="Global Rt" value={data.globalRt.toFixed(2)} />
            <StatTile label="Avg. Public Trust" value={data.globalAvgPublicTrust} />
            <StatTile label="Avg. Happiness" value={data.globalAvgHappiness} />
          </div>

          <RegionBarPanel
            title="Confirmed Cases by Region"
            regions={sortedRegionsByCases}
            valueOf={(r) => r.confirmedCases}
            max={maxCases}
            format={(v) => v.toLocaleString()}
          />
          <RegionBarPanel
            title="Deaths by Region"
            regions={[...data.regions].sort((a, b) => b.deaths - a.deaths)}
            valueOf={(r) => r.deaths}
            max={maxDeaths}
            format={(v) => v.toLocaleString()}
          />
          <RegionBarPanel
            title="Rt by Region"
            regions={[...data.regions].sort((a, b) => b.rt - a.rt)}
            valueOf={(r) => r.rt}
            max={maxRt}
            format={(v) => v.toFixed(2)}
          />
        </div>

        {/* Right: live event feed, newest on top. Items never disappear on
            their own (last 30 stay scrollable) but flash a highlight for a
            while right after they first arrive, so the room's eyes are
            drawn to genuinely new developments. */}
        <div className="w-[420px] xl:w-[480px] shrink-0 border-l border-slate-800 bg-slate-900/60 flex flex-col min-h-0">
          <p className="shrink-0 px-4 py-3 text-xs uppercase tracking-wide text-slate-400 border-b border-slate-800">
            Live Feed
          </p>
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
            {data.feedItems.length === 0 && (
              <p className="text-slate-500 text-sm">Awaiting the first dispatched update from the facilitator...</p>
            )}
            {data.feedItems.map((f) => {
              const arrivedAt = arrivalMap[f.id] ?? 0;
              const isNew = arrivedAt > 0 && now - arrivedAt < 8000;
              const ageSeconds = Math.max(0, Math.round((now - new Date(f.createdAt).getTime()) / 1000));
              return (
                <div
                  key={f.id}
                  className={`rounded-lg px-3 py-2.5 text-sm leading-snug transition-colors duration-1000 ${
                    isNew ? "bg-amber-500/20 border border-amber-500/60 text-amber-100" : "bg-slate-800/60 border border-transparent text-slate-200"
                  }`}
                >
                  <p>{f.text}</p>
                  <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                    {ageSeconds < 60 ? `${ageSeconds}s ago` : `${Math.floor(ageSeconds / 60)}m ago`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl xl:text-3xl font-bold tabular-nums mt-1">{value}</p>
    </div>
  );
}

function RegionBarPanel({
  title,
  regions,
  valueOf,
  max,
  format,
}: {
  title: string;
  regions: { regionId: string; fullName: string; confirmedCases: number; deaths: number; rt: number }[];
  valueOf: (r: { regionId: string; confirmedCases: number; deaths: number; rt: number }) => number;
  max: number;
  format: (v: number) => string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500 mb-3">{title}</p>
      <div className="space-y-2">
        {regions.map((r) => {
          const value = valueOf(r);
          const pct = Math.max(2, Math.round((value / max) * 100));
          return (
            <div key={r.regionId} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-xs font-semibold text-slate-300">{r.regionId}</span>
              <div className="flex-1 h-5 bg-slate-800 rounded overflow-hidden">
                <div className="h-full rounded" style={{ width: `${pct}%`, background: regionColors[r.regionId] }} />
              </div>
              <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums">{format(value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
