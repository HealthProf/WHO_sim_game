"use client";

// Branching event map (Release 5): every event as a node in its act
// (column), arrows for prerequisites, and each node's state, so the
// facilitator can see how events tie together and what's unlocked. Clicking
// a node jumps to it in the event queue below. States are shown with a word
// and an icon as well as color.

interface MapEvent {
  id: string;
  title: string;
  day: number;
  isCorePath: boolean;
}

type NodeState = "done" | "open" | "ready" | "blocked" | "qualifies";

const STATE_STYLE: Record<NodeState, { fill: string; stroke: string; label: string; icon: string }> = {
  done: { fill: "#eee7db", stroke: "#82796a", label: "done", icon: "✓" },
  open: { fill: "#dceefa", stroke: "#0072b2", label: "open now", icon: "●" },
  ready: { fill: "#f9f4ed", stroke: "#56633f", label: "can fire", icon: "▶" },
  qualifies: { fill: "#e1eecc", stroke: "#56633f", label: "trigger met", icon: "★" },
  blocked: { fill: "#f9f4ed", stroke: "#a19786", label: "waiting on prerequisites", icon: "🔒" },
};

const COL_W = 200;
const NODE_W = 176;
const NODE_H = 40;
const ROW_H = 52;
const TOP = 34;

export function EventMap({
  events,
  dispatches,
  chainStatus,
  chainLinks,
  targetHints,
}: {
  events: MapEvent[];
  dispatches: { eventId: string; status: string }[];
  chainStatus: Record<string, { ok: boolean; blockedBy: string[] }>;
  chainLinks: { from: string; to: string }[];
  targetHints?: Record<string, string[]>;
}) {
  const days = [1, 2, 3, 4, 5];
  const pos = new Map<string, { x: number; y: number }>();
  let maxRows = 0;
  for (const d of days) {
    const col = events.filter((e) => e.day === d).sort((a, b) => Number(b.isCorePath) - Number(a.isCorePath) || a.id.localeCompare(b.id));
    col.forEach((e, i) => pos.set(e.id, { x: (d - 1) * COL_W + 12, y: TOP + i * ROW_H }));
    maxRows = Math.max(maxRows, col.length);
  }
  const width = days.length * COL_W;
  const height = TOP + maxRows * ROW_H + 8;

  const stateOf = (id: string): NodeState => {
    const ds = dispatches.filter((d) => d.eventId === id);
    if (ds.length > 0) return ds.every((d) => d.status === "scored" || d.status === "closed") ? "done" : "open";
    if (chainStatus[id]?.ok === false) return "blocked";
    if (targetHints?.[id]?.length) return "qualifies";
    return "ready";
  };

  return (
    <section className="rounded-lg bg-surface p-4" aria-labelledby="event-map-heading">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id="event-map-heading" className="text-sm font-bold text-text">
          Event map
        </h2>
        <p className="flex flex-wrap gap-3 text-[11px] text-neutral-800">
          {(Object.keys(STATE_STYLE) as NodeState[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-sm border-2" style={{ background: STATE_STYLE[s].fill, borderColor: STATE_STYLE[s].stroke }} />
              {STATE_STYLE[s].icon} {STATE_STYLE[s].label}
            </span>
          ))}
          <span>Solid border = required · dashed = optional · arrows = prerequisites</span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <svg width={width} height={height} role="img" aria-label="Event map: events by act with prerequisite arrows">
          <defs>
            <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L8,4 L0,8 z" fill="#82796a" />
            </marker>
          </defs>
          {days.map((d) => (
            <text key={d} x={(d - 1) * COL_W + 12} y={18} fontSize={12} fontWeight={700} fill="#645c50">
              Act {d}
            </text>
          ))}
          {chainLinks.map((l) => {
            const a = pos.get(l.from);
            const b = pos.get(l.to);
            if (!a || !b) return null;
            const x1 = a.x + NODE_W;
            const y1 = a.y + NODE_H / 2;
            const x2 = b.x;
            const y2 = b.y + NODE_H / 2;
            const same = x2 <= x1;
            // Same-act links loop around the column's left edge so they never
            // cut through the events stacked between them.
            const d = same
              ? `M${a.x},${y1} C${a.x - 12},${y1} ${b.x - 12},${y2} ${b.x},${y2}`
              : `M${x1},${y1} C${x1 + 24},${y1} ${x2 - 24},${y2} ${x2},${y2}`;
            return <path key={`${l.from}-${l.to}`} d={d} fill="none" stroke="#a19786" strokeWidth={1.5} markerEnd="url(#arrow)" />;
          })}
          {events.map((e) => {
            const p = pos.get(e.id);
            if (!p) return null;
            const st = STATE_STYLE[stateOf(e.id)];
            return (
              <a key={e.id} href={`#event-${e.id}`} aria-label={`${e.id} ${e.title}: ${st.label}`}>
                <title>{`${e.id}: ${e.title} (${st.label})`}</title>
                <rect
                  x={p.x}
                  y={p.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={8}
                  fill={st.fill}
                  stroke={st.stroke}
                  strokeWidth={2}
                  strokeDasharray={e.isCorePath ? undefined : "5 3"}
                />
                <text x={p.x + 8} y={p.y + 16} fontSize={11} fontWeight={700} fill="#201e1d">
                  {st.icon} {e.id}
                </text>
                <text x={p.x + 8} y={p.y + 31} fontSize={10.5} fill="#474238">
                  {e.title.length > 28 ? `${e.title.slice(0, 27)}…` : e.title}
                </text>
              </a>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
