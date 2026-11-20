"use client";

import { useId, useMemo, useRef, useState } from "react";

// Accessible multi-series line chart (Release 4), hand-built SVG so the
// projector and phones don't pull in a charting library. Follows the
// dataviz skill's rules: one y-axis, 2px lines, recessive grid, a legend
// plus direct end-of-line labels (region colors are under 3:1 on the light
// surface, so labels are the relief), a hover crosshair with a tooltip, and
// a data table view. Text always uses text colors, never the series color.

export interface LineSeries {
  id: string;
  label: string;
  color: string;
  points: { x: number; y: number }[];
}

const THEME = {
  light: { text: "#201e1d", muted: "#645c50", grid: "#dcd3c4", surface: "#f5ead8", tooltip: "#2e2b25", tooltipText: "#f9f4ed" },
  dark: { text: "#f9f4ed", muted: "#c0b6a5", grid: "#474238", surface: "#2e2b25", tooltip: "#f9f4ed", tooltipText: "#201e1d" },
};

const W = 640;
const H = 260;
const M = { top: 14, right: 64, bottom: 30, left: 46 };

export function LineChart({
  title,
  series,
  theme = "light",
  yFormat = (v) => String(Math.round(v)),
  yDomain,
  reference,
  highlightId,
  xLabel = "Minutes into the game",
  compact = false,
}: {
  title: string;
  series: LineSeries[];
  theme?: "light" | "dark";
  yFormat?: (v: number) => string;
  yDomain?: [number, number];
  // A labeled horizontal reference line, e.g. Rt = 1.
  reference?: { y: number; label: string };
  highlightId?: string;
  xLabel?: string;
  compact?: boolean;
}) {
  const t = THEME[theme];
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const tableId = useId();

  const xs = series[0]?.points.map((p) => p.x) ?? [];
  const xMax = Math.max(1, xs[xs.length - 1] ?? 1);
  const [yMin, yMax] = useMemo(() => {
    if (yDomain) return yDomain;
    const all = series.flatMap((s) => s.points.map((p) => p.y)).concat(reference ? [reference.y] : []);
    const max = Math.max(...all, 1);
    return [0, niceCeil(max * 1.08)] as [number, number];
  }, [series, yDomain, reference]);

  const sx = (x: number) => M.left + (x / xMax) * (W - M.left - M.right);
  const sy = (y: number) => M.top + (1 - (y - yMin) / (yMax - yMin || 1)) * (H - M.top - M.bottom);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => yMin + f * (yMax - yMin));

  // End labels, nudged apart so they don't collide.
  const endLabels = series
    .map((s) => ({ id: s.id, label: s.label, y: sy(s.points[s.points.length - 1]?.y ?? 0) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < endLabels.length; i++) {
    if (endLabels[i].y - endLabels[i - 1].y < 12) endLabels[i].y = endLabels[i - 1].y + 12;
  }

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg || xs.length === 0) return;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const dataX = ((x - M.left) / (W - M.left - M.right)) * xMax;
    let best = 0;
    xs.forEach((v, i) => {
      if (Math.abs(v - dataX) < Math.abs(xs[best] - dataX)) best = i;
    });
    setHoverIdx(best);
  }

  const hover = hoverIdx != null ? series.map((s) => ({ s, p: s.points[hoverIdx] })).filter((d) => d.p).sort((a, b) => b.p.y - a.p.y) : null;
  const hoverX = hoverIdx != null ? sx(xs[hoverIdx]) : 0;

  return (
    <figure className="m-0">
      <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: t.muted }}>
          {title}
        </span>
        {series.length >= 2 && (
          <span className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]" style={{ color: t.text }} aria-hidden="true">
            {series.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1">
                <span className="inline-block h-[3px] w-3 rounded" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full touch-none"
          role="img"
          aria-label={`${title}. ${series.map((s) => `${s.label} ${yFormat(s.points[s.points.length - 1]?.y ?? 0)}`).join(", ")}. Full values in the data table.`}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHoverIdx(null)}
        >
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={M.left} x2={W - M.right} y1={sy(v)} y2={sy(v)} stroke={t.grid} strokeWidth={1} />
              <text x={M.left - 6} y={sy(v)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={t.muted}>
                {yFormat(v)}
              </text>
            </g>
          ))}
          {reference && reference.y >= yMin && reference.y <= yMax && (
            <g>
              <line x1={M.left} x2={W - M.right} y1={sy(reference.y)} y2={sy(reference.y)} stroke={t.muted} strokeWidth={1} strokeDasharray="4 4" />
              <text x={M.left + 4} y={sy(reference.y) - 4} fontSize={10} fill={t.muted}>
                {reference.label}
              </text>
            </g>
          )}
          <text x={(M.left + W - M.right) / 2} y={H - 6} textAnchor="middle" fontSize={11} fill={t.muted}>
            {xLabel}
          </text>
          <text x={M.left} y={H - 16} textAnchor="start" fontSize={10} fill={t.muted}>
            0
          </text>
          <text x={W - M.right} y={H - 16} textAnchor="end" fontSize={10} fill={t.muted}>
            {Math.round(xMax)}
          </text>

          {series.map((s) => {
            const dim = highlightId && s.id !== highlightId;
            return (
              <polyline
                key={s.id}
                fill="none"
                stroke={s.color}
                strokeWidth={highlightId === s.id ? 3 : 2}
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={dim ? 0.45 : 1}
                points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")}
              />
            );
          })}

          {endLabels.map((l) => (
            <text key={l.id} x={W - M.right + 6} y={l.y} dominantBaseline="middle" fontSize={11} fontWeight={l.id === highlightId ? 700 : 500} fill={t.text}>
              {l.label}
            </text>
          ))}

          {hover && (
            <g pointerEvents="none">
              <line x1={hoverX} x2={hoverX} y1={M.top} y2={H - M.bottom} stroke={t.muted} strokeWidth={1} />
              {hover.map(({ s, p }) => (
                <circle key={s.id} cx={hoverX} cy={sy(p.y)} r={4} fill={s.color} stroke={t.surface} strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
        {hover && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-[120px] rounded-md px-2.5 py-1.5 text-[11px] shadow-md"
            style={{
              background: t.tooltip,
              color: t.tooltipText,
              left: `${(hoverX / W) * 100}%`,
              transform: hoverX > W / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
            }}
          >
            <p className="mb-0.5 font-semibold">{Math.round(xs[hoverIdx!])} min</p>
            {hover.map(({ s, p }) => (
              <p key={s.id} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="tabular-nums">{yFormat(p.y)}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      {!compact && (
        <details className="mt-1 text-[11px]" style={{ color: t.muted }}>
          <summary className="cursor-pointer" aria-controls={tableId}>
            Show data table
          </summary>
          <div className="mt-1 max-h-48 overflow-auto">
            <table id={tableId} className="w-full border-collapse text-left tabular-nums" style={{ color: t.text }}>
              <thead>
                <tr>
                  <th className="pr-2 font-semibold">Min</th>
                  {series.map((s) => (
                    <th key={s.id} className="pr-2 font-semibold">
                      {s.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {xs.map((x, i) =>
                  i % 4 === 0 || i === xs.length - 1 ? (
                    <tr key={i}>
                      <td className="pr-2">{Math.round(x)}</td>
                      {series.map((s) => (
                        <td key={s.id} className="pr-2">
                          {yFormat(s.points[i]?.y ?? 0)}
                        </td>
                      ))}
                    </tr>
                  ) : null
                )}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}
