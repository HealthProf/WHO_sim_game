"use client";

import { useEffect, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { countryToRegion, regionColors, regionCentroids } from "@/lib/who-region-map";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface DisplayData {
  currentDay: number;
  escalationState: "GREEN" | "AMBER" | "RED";
  mediaPressureIndex: number;
  simulationStatus: string;
  globalRt: number;
  regions: { regionId: string; fullName: string; confirmedCases: number; deaths: number; rt: number }[];
  feedItems: { id: number; text: string; createdAt: string }[];
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

  if (!data) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Loading situation room...</div>;

  const maxCases = Math.max(...data.regions.map((r) => r.confirmedCases), 1);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col overflow-hidden">
      <header className={`px-8 py-4 flex items-center justify-between ${escalationBg[data.escalationState]}`}>
        <h1 className="text-2xl font-bold tracking-wide">OPERATION VEILED HORIZON — GLOBAL SITUATION ROOM</h1>
        <div className="flex items-center gap-6 text-lg font-semibold">
          <span>DAY {data.currentDay}</span>
          <span>{data.escalationState}</span>
          <span>Global Rt {data.globalRt.toFixed(2)}</span>
          <span>Media Pressure {data.mediaPressureIndex}</span>
        </div>
      </header>

      <div className="flex-1 relative">
        <ComposableMap projectionConfig={{ scale: 155 }} className="w-full h-full">
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
            const radius = 6 + 24 * Math.sqrt(r.confirmedCases / maxCases);
            return (
              <Marker key={r.regionId} coordinates={centroid}>
                <circle r={radius} fill={regionColors[r.regionId]} fillOpacity={0.55} stroke="#fff" strokeWidth={1} />
                <text textAnchor="middle" y={-radius - 6} className="fill-white text-[10px] font-semibold">
                  {r.regionId}: {r.confirmedCases}
                </text>
              </Marker>
            );
          })}
        </ComposableMap>

        <div className="absolute top-4 right-4 bg-slate-900/80 rounded-lg p-3 text-xs space-y-1">
          {Object.entries(regionColors).map(([region, color]) => (
            <div key={region} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />
              {region}
            </div>
          ))}
        </div>
      </div>

      <footer className="bg-slate-900 border-t border-slate-800 py-3 overflow-hidden whitespace-nowrap">
        <div className="animate-marquee inline-block text-sm text-amber-300">
          {data.feedItems.length > 0
            ? data.feedItems.map((f) => `● ${f.text}`).join("     ")
            : "● Awaiting the first dispatched update from the facilitator..."}
        </div>
      </footer>
    </div>
  );
}
