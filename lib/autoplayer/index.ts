// The autoplayer interface — deliberately just an interface plus one
// scripted implementation (lib/autoplayer/scripted.ts). No LLM call
// anywhere: it would put a paid API on the critical path of a free-tier
// deployment, add latency inside a time-pressured session, create a cost
// surface that scales with exactly the popularity a public demo wants, and
// inject nondeterminism into the one thing that must be reliable for a
// stranger clicking in from LinkedIn.
import type { events, modelState } from "../db/schema";
import type { RegionId } from "../regions";
import type { Tier } from "../db/seed-data/events";

export type CompetenceProfile = "strong" | "mixed" | "struggling";

export interface AutoplayerDecision {
  optionLabel: string | null; // null for the free-text/allocation events
  rationaleText: string;
  resourceAllocationJson?: Record<string, number>;
  confidenceLevel: "LOW" | "MEDIUM" | "HIGH" | null;
  // The tier this decision fast-path-scores as — for a structured-option
  // choice this is that option's own suggestedTier; for the four events
  // with no structured options (lib/autoplayer/scripted.ts), it's sampled
  // directly from the profile's distribution since there's no per-option
  // tier to derive it from.
  tier: Tier;
  // Why this was picked — not shown to players, just useful for debugging
  // and for a debrief-facing "how the AI regions played" summary.
  rationale: string;
}

export interface AutoplayerBackend {
  decideForRegion(ctx: {
    sessionId: string;
    regionId: RegionId;
    event: typeof events.$inferSelect;
    modelState: typeof modelState.$inferSelect;
    profile: CompetenceProfile;
  }): Promise<AutoplayerDecision>;
}

export { scriptedAutoplayer } from "./scripted";
