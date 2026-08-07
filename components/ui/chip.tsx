// Status/tier chips — the design system's rule is "never encode a scoring
// tier or status by color alone," so every chip always carries its word.
// Only two accent hues exist in this palette (terracotta = needs attention,
// sage = you/positive), plus the neutral ramp for everything else — no
// emerald/blue/amber/red/purple Tailwind defaults.
export type ChipTone = "accent-solid" | "accent-soft" | "sage-soft" | "neutral-soft" | "neutral-outline";

const toneClass: Record<ChipTone, string> = {
  "accent-solid": "bg-accent-700 text-white",
  "accent-soft": "bg-accent-200 text-accent-700",
  "sage-soft": "bg-accent-2-200 text-accent-2-800",
  "neutral-soft": "bg-neutral-200 text-neutral-800",
  "neutral-outline": "border border-divider text-neutral-700",
};

export function Chip({ tone = "neutral-soft", className = "", children }: { tone?: ChipTone; className?: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${toneClass[tone]} ${className}`}>
      {children}
    </span>
  );
}

// The four scoring tiers map onto fixed tones per the handoff's color rules.
const tierTone: Record<string, ChipTone> = {
  OPTIMAL: "sage-soft",
  ADEQUATE: "neutral-soft",
  INADEQUATE: "accent-soft",
  CRITICAL_FAILURE: "accent-solid",
};

export function TierChip({ tier, className = "" }: { tier: string; className?: string }) {
  return (
    <Chip tone={tierTone[tier] ?? "neutral-soft"} className={className}>
      {tier.replace("_", " ")}
    </Chip>
  );
}
