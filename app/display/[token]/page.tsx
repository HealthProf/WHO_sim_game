"use client";

import { useEffect, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { countryToRegion, regionColors, regionCentroids } from "@/lib/who-region-map";
import { SimClock } from "@/components/sim-clock";
import type { GlobalClockFields } from "@/lib/sim-clock";
import { SummaryReportViewer } from "@/components/summary-report-viewer";
import type { SummaryRound } from "@/lib/summary-report";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface DisplayData extends GlobalClockFields {
  currentDay: number;
  escalationState: "GREEN" | "AMBER" | "RED";
  mediaPressureIndex: number;
  simulationStatus: string;
  globalRt: number;
  regions: { regionId: string; fullName: string; confirmedCases: number; deaths: number; rt: number }[];
  feedItems: { id: number; text: string; createdAt: string }[];
  rounds: SummaryRound[] | null;
}

const escalationBg: Record<string, string> = {
  GREEN: "bg-emerald-700",
  AMBER: "bg-amber-600",
  RED: "bg-red-700",
};

export default function PublicDisplayPage() {
  const [data, setData] = useState<DisplayData | null>(null);

  useEffect(() => {
    let active = true;
    async function poll() {
      const res = await fetch("/api/display");
      if (res.ok && active) setData(await res.json());
    }
    poll();
    const interval = setInterval(poll, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (!data) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-3xl">
        Loading situation room...
      </div>
    );
  }

  if (data.simulationStatus === "completed" && data.rounds) {
    return (
      <div className="h-screen w-screen bg-slate-950 text-white flex flex-col overflow-hidden">
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
      <header className={`shrink-0 px-8 py-5 flex flex-wrap items-center justify-between gap-4 ${escalationBg[data.escalationState]}`}>
        <h1 className="text-3xl xl:text-4xl font-bold tracking-wide">OPERATION VEILED HORIZON</h1>
        <SimClock state={data} size="lg" />
        <div className="flex items-center gap-8 text-xl xl:text-2xl font-semibold">
          <span>{data.escalationState}</span>
          <span>Global Rt {data.globalRt.toFixed(2)}</span>
          <span>Media Pressure {data.mediaPressureIndex}</span>
        </div>
      </header>

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
        <div className="animate-marquee inline-block text-2xl xl:text-3xl font-semibold text-amber-300">
          {data.feedItems.length > 0
            ? data.feedItems.map((f) => `● ${f.text}`).join("     ")
            : "● Awaiting the first dispatched update from the facilitator..."}
        </div>
      </footer>
    </div>
  );
}
