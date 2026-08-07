"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
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

// The projector is the app's one dark, full-bleed, no-navigation surface —
// always dark regardless of the light system elsewhere, per the handoff.
// Escalation severity climbs through the neutral -> accent ramp (never a
// second hue) so it stays legible next to everything else on this screen.
const escalationBg: Record<string, string> = {
  GREEN: "bg-neutral-800",
  AMBER: "bg-accent-700",
  RED: "bg-accent-900",
};

export default function PublicDisplayPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
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
    let timeoutId: ReturnType<typeof setTimeout>;
    let lastVersion: number | null = null;
    const DEFAULT_POLL_MS = 4000;

    async function poll() {
      let nextDelay = DEFAULT_POLL_MS;
      try {
        const since = lastVersion != null ? `&since=${lastVersion}` : "";
        const res = await fetch(`/api/display?token=${encodeURIComponent(token)}${since}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const json = await res.json();
        if (!active) return;
        setLastError(null);
        setLastSuccessAt(Date.now());

        if (json.unchanged) {
          // Phase 5 poll backoff: state hasn't changed since our last known
          // version — skip re-rendering entirely and just widen the next
          // poll interval, per the server's suggestion.
          nextDelay = json.nextPollMs ?? DEFAULT_POLL_MS;
        } else {
          setData(json);
          lastVersion = json.stateVersion ?? null;
          const incoming = json.activeAnnouncement as DisplayAnnouncement | null;
          if (incoming) {
            setAnnouncementSeen((prev) => (prev?.id === incoming.id ? prev : { id: incoming.id, seenAt: Date.now() }));
          }
        }
      } catch (err) {
        if (!active) return;
        setLastError(err instanceof Error ? err.message : "Failed to reach the server");
      } finally {
        if (active) timeoutId = setTimeout(poll, nextDelay);
      }
    }
    if (!token) return;
    poll();
    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [token]);

  // Never gets permanently stuck: if we have no data yet and the last
  // attempt failed, show a visible error with an automatic retry countdown
  // instead of an indefinite "Loading..." screen.
  if (!data) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-neutral-900 px-8 text-center text-3xl text-neutral-400">
        <p>{lastError ? "Couldn't reach the server" : "Loading situation room..."}</p>
        {lastError && <p className="text-lg text-accent-400">{lastError} — retrying every 10s</p>}
      </div>
    );
  }

  // Data is stale if the last successful poll was more than ~40s ago
  // (four missed cycles) — surface it rather than silently showing old
  // numbers forever if the connection has actually dropped.
  const isStale = lastSuccessAt !== null && now - lastSuccessAt > 40000;

  const staleBanner = isStale && (
    <div className="shrink-0 bg-accent-900 py-1.5 text-center text-sm font-medium text-white">
      Connection to the server may be lost — last updated {Math.round((now - lastSuccessAt!) / 1000)}s ago, still retrying
    </div>
  );

  if (data.simulationStatus === "completed" && data.rounds) {
    return (
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-900 text-white">
        {staleBanner}
        <header className="shrink-0 bg-neutral-800 px-8 py-6 text-center">
          <h1 className="font-heading text-4xl tracking-wide xl:text-5xl">SIMULATION COMPLETE — SUMMARY REPORT</h1>
        </header>
        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto p-8">
          {data.finalResults && (
            <section className="space-y-4 rounded-lg bg-neutral-800 p-6">
              <h2 className="font-heading text-2xl">Final Results: Actual vs. Ideal Playthrough</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatTile label="Actual Confirmed" value={data.finalResults.totalActualConfirmed.toLocaleString()} />
                <StatTile label="Actual Deaths" value={data.finalResults.totalActualDeaths.toLocaleString()} />
                <StatTile label="Ideal Confirmed" value={data.finalResults.totalOptimalConfirmed.toLocaleString()} />
                <StatTile label="Ideal Deaths" value={data.finalResults.totalOptimalDeaths.toLocaleString()} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-accent-900 p-4">
                  <p className="text-sm uppercase tracking-wide text-accent-300">Infections Preventable</p>
                  <p className="mt-1 text-4xl font-bold">{data.finalResults.totalInfectionsPrevented.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-accent-900 p-4">
                  <p className="text-sm uppercase tracking-wide text-accent-300">Deaths Preventable</p>
                  <p className="mt-1 text-4xl font-bold">{data.finalResults.totalDeathsPrevented.toLocaleString()}</p>
                </div>
              </div>
            </section>
          )}
          {data.teamChapters && data.teamChapters.length > 0 && (
            <section className="space-y-4">
              <h2 className="font-heading text-2xl">Chapters of History</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.teamChapters.map((c) => (
                  <div key={c.regionId} className="space-y-2 rounded-lg bg-neutral-800 p-5">
                    <p className="text-xl font-bold text-white">{c.headline}</p>
                    <p className="text-sm text-neutral-300">{c.narrative}</p>
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
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-900 text-white">
      {staleBanner}
      <header className={`flex shrink-0 flex-wrap items-center justify-between gap-4 px-8 py-5 ${escalationBg[data.escalationState]}`}>
        <h1 className="font-heading text-3xl tracking-wide xl:text-4xl">OPERATION VEILED HORIZON</h1>
        <SimClock state={data} size="lg" />
        <div className="flex items-center gap-8 text-xl font-semibold xl:text-2xl">
          <span>{data.escalationState}</span>
          <span>Global Rt {data.globalRt.toFixed(2)}</span>
          <span>Media Pressure {data.mediaPressureIndex}</span>
        </div>
      </header>

      {/* Item 12's "single world health bar" — one shared composite number
          (see lib/world-health.ts) the whole room watches together, instead
          of six regions' worth of stats competing for attention. The fill
          climbs the neutral -> accent-2 -> accent ramp (good = sage, bad =
          terracotta) with the index and its descriptor as a direct label
          rather than color alone. */}
      <div className="flex shrink-0 items-center gap-4 border-b border-neutral-800 bg-neutral-900 px-8 py-3">
        <span className="shrink-0 text-xs uppercase tracking-widest text-neutral-500">World Health</span>
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-neutral-800">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${
              data.worldHealth.index >= 55 ? "bg-accent-2-500" : data.worldHealth.index >= 35 ? "bg-accent-500" : "bg-accent-800"
            }`}
            style={{ width: `${Math.max(3, data.worldHealth.index)}%` }}
          />
        </div>
        <span className="shrink-0 text-lg font-bold tabular-nums">{data.worldHealth.index}/100</span>
        <span className="w-32 shrink-0 text-sm text-neutral-500">{data.worldHealth.label}</span>
      </div>

      {data.snapVote && (
        <div className="flex shrink-0 items-center justify-between gap-6 bg-accent-800 px-8 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-200">Emergency Committee — Snap Vote</p>
            <p className="text-xl font-bold text-white xl:text-2xl">{data.snapVote.question}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-3xl font-bold tabular-nums text-white xl:text-4xl">
              {Math.max(0, Math.ceil((new Date(data.snapVote.closesAt).getTime() - now) / 1000))}s
            </p>
            <p className="text-sm text-accent-200">{data.snapVote.respondedCount}/{data.snapVote.totalTeams} regions responded</p>
          </div>
        </div>
      )}

      {data.activeDeadlines.length > 0 && (
        <div className="flex shrink-0 items-center gap-6 overflow-x-auto border-b border-neutral-800 bg-neutral-900 px-8 py-2">
          <span className="shrink-0 text-xs uppercase tracking-wide text-neutral-500">Active Deadlines</span>
          {data.activeDeadlines.map((d) => {
            const remainingMs = Math.max(0, new Date(d.deadlineAt).getTime() - now);
            const minutes = Math.floor(remainingMs / 60000);
            const seconds = Math.floor((remainingMs % 60000) / 1000);
            return (
              <span key={d.eventTitle} className="shrink-0 whitespace-nowrap text-sm text-neutral-300">
                {d.eventTitle}: <span className="font-semibold tabular-nums text-accent-400">{minutes}m {String(seconds).padStart(2, "0")}s</span>
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
            <div className="w-full max-w-5xl animate-fade-in-slow text-center">
              <p className="mb-6 text-sm font-semibold uppercase tracking-[0.3em] text-accent-500">{data.activeAnnouncement.title}</p>
              <p className="text-4xl font-bold leading-snug text-white xl:text-6xl">{data.activeAnnouncement.message}</p>
            </div>
          </div>
        ) : (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-12">
            <div className="w-full max-w-4xl rounded-2xl border-4 border-accent bg-accent-900 p-10 text-center shadow-2xl">
              <p className="mb-3 text-lg font-semibold uppercase tracking-widest text-accent-300">{data.activeAnnouncement.title}</p>
              <p className="text-3xl font-bold leading-snug text-white xl:text-4xl">{data.activeAnnouncement.message}</p>
            </div>
          </div>
        ))}

      <div className="flex flex-1 gap-0 min-h-0">
        {/* Left: real-time key metrics — stat tiles plus a bar per region for
            each of confirmed cases, deaths, and Rt. Bars carry a direct
            region-code + value label rather than relying on color alone to
            tell regions apart (the brand palette fails a strict CVD check at
            6 hues — see dataviz skill palette validation). */}
        <div className="min-w-0 flex-1 space-y-6 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
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
        <div className="flex min-h-0 w-[420px] shrink-0 flex-col border-l border-neutral-800 bg-neutral-900 xl:w-[480px]">
          <p className="shrink-0 border-b border-neutral-800 px-4 py-3 text-xs uppercase tracking-wide text-neutral-500">
            Live Feed
          </p>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
            {data.feedItems.length === 0 && (
              <p className="text-sm text-neutral-500">Awaiting the first dispatched update from the facilitator...</p>
            )}
            {data.feedItems.map((f) => {
              const arrivedAt = arrivalMap[f.id] ?? 0;
              const isNew = arrivedAt > 0 && now - arrivedAt < 8000;
              const ageSeconds = Math.max(0, Math.round((now - new Date(f.createdAt).getTime()) / 1000));
              return (
                <div
                  key={f.id}
                  className={`rounded-lg border px-3 py-2.5 text-sm leading-snug transition-colors duration-1000 ${
                    isNew ? "border-accent-500/60 bg-accent-500/20 text-accent-100" : "border-transparent bg-neutral-800 text-neutral-200"
                  }`}
                >
                  <p>{f.text}</p>
                  <p className={`mt-1 text-[11px] tabular-nums ${isNew ? "text-accent-300" : "text-neutral-400"}`}>
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
    <div className="rounded-lg bg-neutral-800 p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums xl:text-3xl">{value}</p>
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
    <div className="rounded-lg bg-neutral-800 p-4">
      <p className="mb-3 text-xs uppercase tracking-wide text-neutral-400">{title}</p>
      <div className="space-y-2">
        {regions.map((r) => {
          const value = valueOf(r);
          const pct = Math.max(2, Math.round((value / max) * 100));
          return (
            <div key={r.regionId} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-xs font-semibold text-neutral-300">{r.regionId}</span>
              <div className="h-5 flex-1 overflow-hidden rounded bg-neutral-700">
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
