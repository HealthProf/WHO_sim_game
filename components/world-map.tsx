"use client";

import { useMemo, type ReactNode } from "react";
import { buildWorldGeometry } from "@/lib/world-geo";
import { regionColor } from "@/lib/region-colors";

// The six WHO regions on a world map (Release 4), each in its identity color
// and always labeled with its code and the current value, so identity is
// never color-alone. Optionally zooms to one region (the projector
// spotlight); the zoom animates only when the viewer hasn't asked for
// reduced motion (motion-safe:).
export function WorldMap({
  values,
  metricLabel,
  theme = "light",
  focusRegion,
  ownRegion,
  badges,
}: {
  values: Record<string, string>;
  metricLabel: string;
  theme?: "light" | "dark";
  focusRegion?: string | null;
  ownRegion?: string | null;
  // Optional small graphic per region (e.g. its avatar), drawn at the label.
  badges?: Record<string, ReactNode>;
}) {
  const geo = useMemo(() => buildWorldGeometry(960, 470), []);
  const dark = theme === "dark";
  const labelText = dark ? "#f9f4ed" : "#201e1d";
  const labelHalo = dark ? "#2e2b25" : "#f5ead8";
  const gray = dark ? "#474238" : "#dcd3c4";
  const coast = dark ? "#2e2b25" : "#f5ead8";

  const transform = useMemo(() => {
    const r = focusRegion ? geo.regions.find((x) => x.regionId === focusRegion) : null;
    if (!r) return "translate(0px, 0px) scale(1)";
    const [[x0, y0], [x1, y1]] = r.bounds;
    const pad = 40;
    const scale = Math.min(3.2, Math.min(geo.width / (x1 - x0 + pad * 2), geo.height / (y1 - y0 + pad * 2)));
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    return `translate(${geo.width / 2 - cx * scale}px, ${geo.height / 2 - cy * scale}px) scale(${scale})`;
  }, [focusRegion, geo]);
  const labelScale = transform.includes("scale(1)") ? 1 : 1 / Number(/scale\(([\d.]+)\)/.exec(transform)?.[1] ?? 1);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${geo.width} ${geo.height}`}
        className="block h-auto w-full overflow-hidden"
        role="img"
        aria-label={`World map of WHO regions showing ${metricLabel}: ${Object.entries(values)
          .map(([r, v]) => `${r} ${v}`)
          .join(", ")}${focusRegion ? `. Focused on ${focusRegion}.` : ""}`}
      >
        <g style={{ transform, transformOrigin: "0 0" }} className="motion-safe:transition-transform motion-safe:duration-[1400ms] motion-safe:ease-in-out">
          {geo.unassigned.map((d, i) => (
            <path key={i} d={d} fill={gray} stroke={coast} strokeWidth={0.5 * labelScale} />
          ))}
          {geo.regions.map((r) => (
            <path
              key={r.regionId}
              d={r.path}
              fill={regionColor(r.regionId, theme)}
              fillOpacity={focusRegion && focusRegion !== r.regionId ? 0.35 : 0.9}
              stroke={r.regionId === ownRegion ? labelText : coast}
              strokeWidth={(r.regionId === ownRegion ? 2.5 : 0.8) * labelScale}
            />
          ))}
          {geo.regions.map((r) => (
            <g key={`l-${r.regionId}`} transform={`translate(${r.labelAt[0]}, ${r.labelAt[1]}) scale(${labelScale})`}>
              {badges?.[r.regionId] && <g transform="translate(-14, -46)">{badges[r.regionId]}</g>}
              <text
                textAnchor="middle"
                fontSize={15}
                fontWeight={700}
                fill={labelText}
                stroke={labelHalo}
                strokeWidth={4}
                paintOrder="stroke"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {r.regionId}
              </text>
              <text y={17} textAnchor="middle" fontSize={13} fontWeight={600} fill={labelText} stroke={labelHalo} strokeWidth={4} paintOrder="stroke">
                {values[r.regionId] ?? ""}
              </text>
            </g>
          ))}
        </g>
      </svg>
      <figcaption className="mt-1 text-[11px]" style={{ color: dark ? "#c0b6a5" : "#645c50" }}>
        {metricLabel} by WHO region. Gray areas are outside WHO regional membership or not assigned on this map.
      </figcaption>
    </figure>
  );
}
