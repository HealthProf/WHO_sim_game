import { BANDS, METRIC_LABEL, HIGHER_IS_WORSE, bandFor, type IndexMetric } from "@/lib/index-bands";

// A 0-100 index as a banded bar (Release 1): each band is a shaded segment,
// a marker shows the current value, and the band's name and what the next
// threshold means are written out. Tints only reinforce the words.
const SEGMENT_TINT = ["bg-accent-2-300", "bg-neutral-300", "bg-accent-200", "bg-accent-300", "bg-accent-400"] as const;
const LABEL_TONE = ["text-accent-2-800", "text-neutral-800", "text-accent-700", "text-accent-800", "text-accent-900"] as const;

export function IndexGauge({ metric, value, compact = false }: { metric: IndexMetric; value: number; compact?: boolean }) {
  const band = bandFor(metric, value);
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="rounded-md bg-bg p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs text-neutral-700">
          {METRIC_LABEL[metric]} <span className="text-neutral-600">({HIGHER_IS_WORSE[metric] ? "lower is better" : "higher is better"})</span>
        </p>
        <p className="text-base font-bold text-text">
          {Math.round(value)} <span className={`text-sm ${LABEL_TONE[band.severity]}`}>· {band.label}</span>
        </p>
      </div>
      <div
        className="relative mt-2 flex h-2.5 overflow-hidden rounded-full"
        role="meter"
        aria-label={METRIC_LABEL[metric]}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value)}
        aria-valuetext={`${Math.round(value)}, ${band.label}`}
      >
        {BANDS[metric].map((b) => (
          <div key={b.label} className={SEGMENT_TINT[b.severity]} style={{ width: `${b.max - b.min + 1}%` }} title={`${b.label}: ${b.min}-${b.max}`} />
        ))}
        <div className="absolute top-0 h-full w-[3px] -translate-x-1/2 bg-neutral-900" style={{ left: `${pct}%` }} />
      </div>
      {!compact && <p className="mt-1.5 text-xs text-neutral-700">{band.note}</p>}
    </div>
  );
}
