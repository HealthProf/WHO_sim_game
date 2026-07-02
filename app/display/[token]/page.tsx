"use client";

import { useEffect, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { countryToRegion, regionColors, regionCentroids } from "@/lib/who-region-map";
import { SimClock } from "@/components/sim-clock";
import type { GlobalClockFields } from "@/lib/sim-clock";
import { SummaryReportViewer } from "@/components/summary-report-viewer";
import type { SummaryRound } from "@/lib/summary-report";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface DisplaySnapVote {
  question: string;
  options: string[];
  closesAt: string;
  respondedCount: number;
  totalTeams: number;
}

interface DisplayAnnouncement {
  id: number;
  title: string;
  message: string;
  autoDismissSeconds: number | null;
  createdAt: string;
}

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
}

// Ticker duration scales with how much text there actually is, instead of a
// fixed duration that made long feed lists race past unreadably fast —
// roughly a comfortable reading pace, with sane floor/ceiling.
function tickerDurationSeconds(text: string): number {
  return Math.min(180, Math.max(30, text.length * 0.15));
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
  const isStale = lastSuccessAt !== null && Date.now() - lastSuccessAt > 40000;

  const staleBanner = isStale && (
    <div className="shrink-0 bg-red-900 text-white text-center py-1.5 text-sm font-medium">
      Connection to the server may be lost — last updated {Math.round((Date.now() - lastSuccessAt!) / 1000)}s ago, still retrying
    </div>
  );

  if (data.simulationStatus === "completed" && data.rounds) {
    return (
      <div className="h-screen w-screen bg-slate-950 text-white flex flex-col overflow-hidden">
        {staleBanner}
        <header className="shrink-0 px-8 py-6 bg-slate-800 text-center">
          <h1 className="text-4xl xl:text-5xl font-bold tracking-wide">SIMULATION COMPLETE — SUMMARY REPORT</h1>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto p-8">
          <SummaryReportViewer rounds={data.rounds} large />
        </div>
      </div>
    );
  }

  const maxCases = Math.max(...data.regions.map((r) => r.confirmedCases), 1);

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
        now - announcementSeen.seenAt < (data.activeAnnouncement.autoDismissSeconds ?? 10) * 1000 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-12 pointer-events-none">
            <div className="max-w-4xl w-full rounded-2xl border-4 border-blue-500 bg-blue-950 p-10 text-center shadow-2xl">
              <p className="text-lg uppercase tracking-widest text-blue-300 font-semibold mb-3">{data.activeAnnouncement.title}</p>
              <p className="text-3xl xl:text-4xl font-bold text-white leading-snug">{data.activeAnnouncement.message}</p>
            </div>
          </div>
        )}

      <div className="flex-1 min-h-0 relative">
        <ComposableMap projectionConfig={{ scale: 155 }} width={980} height={520} className="w-full h-full">
          <Geographies geography={GEO_URL}>
            {({ geographies }: { geographies: Array<{ rsmKey: string; id: string; properties: { iso_a3?: string } }> }) =>
              geographies.map((geo) => {
                const iso3 = geo.properties.iso_a3 ?? geo.id;
                const region = countryToRegion[iso3];
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={region ? regionColors[region] : "#1e293b"}
                    stroke="#0f172a"
                    strokeWidth={0.5}
                    style={{ default: { outline: "none" }, hover: { outline: "none" }, pressed: { outline: "none" } }}
                  />
                );
              })
            }
          </Geographies>
          {data.regions.map((r) => {
            const centroid = regionCentroids[r.regionId];
            if (!centroid) return null;
            const radius = 8 + 30 * Math.sqrt(r.confirmedCases / maxCases);
            return (
              <Marker key={r.regionId} coordinates={centroid}>
                <circle r={radius} fill={regionColors[r.regionId]} fillOpacity={0.55} stroke="#fff" strokeWidth={1.5} />
                <text textAnchor="middle" y={-radius - 8} className="fill-white text-[15px] font-bold">
                  {r.regionId}: {r.confirmedCases}
                </text>
              </Marker>
            );
          })}
        </ComposableMap>

        <div className="absolute top-4 right-4 bg-slate-900/80 rounded-lg p-4 text-base space-y-2">
          {Object.entries(regionColors).map(([region, color]) => (
            <div key={region} className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full inline-block" style={{ background: color }} />
              {region}
            </div>
          ))}
        </div>
      </div>

      <footer className="shrink-0 bg-slate-900 border-t border-slate-800 py-4 overflow-hidden whitespace-nowrap">
        {(() => {
          const tickerText =
            data.feedItems.length > 0
              ? data.feedItems.map((f) => `● ${f.text}`).join("     ")
              : "● Awaiting the first dispatched update from the facilitator...";
          return (
            <div
              className="animate-marquee inline-block text-2xl xl:text-3xl font-semibold text-amber-300"
              style={{ animationDuration: `${tickerDurationSeconds(tickerText)}s` }}
            >
              {tickerText}
            </div>
          );
        })()}
      </footer>
    </div>
  );
}
