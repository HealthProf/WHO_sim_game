// Region avatar moods (Release 4), pure so the same mood shows everywhere.
// Thresholds reuse the ones the simulation already acts on
// (lib/index-bands.ts): trust/morale warnings fire below 45 and 30; the
// first reward milestone is 80. "Shocked" means a sharp worsening in the last
// few minutes (lib/history.ts recentChanges), which wins over the steady-
// state mood so a sudden blow is visible right away.
import type { RegionChange } from "./history";

export type Mood = "thriving" | "calm" | "worried" | "distressed" | "shocked";

export const MOOD_LABEL: Record<Mood, string> = {
  thriving: "thriving",
  calm: "steady",
  worried: "worried",
  distressed: "in distress",
  shocked: "shocked by a sudden setback",
};

// Trust and morale are optional: shared screens only know a region's public
// numbers (Rt and recent public changes), so its mood there is based on
// those alone and never reveals its private standing.
export function moodFor(
  state: { publicTrustIndex?: number; populationHappinessIndex?: number; rt: number },
  recentChanges: RegionChange[] = [],
  regionId?: string
): Mood {
  if (regionId && recentChanges.some((c) => c.regionId === regionId && c.direction === "worse" && c.magnitude >= 1.5)) return "shocked";
  const trust = state.publicTrustIndex ?? 60;
  const morale = state.populationHappinessIndex ?? 60;
  const rt = state.rt;
  const known = state.publicTrustIndex != null;
  if (trust < 30 || morale < 30 || rt >= 2) return "distressed";
  if (trust < 45 || morale < 45 || rt >= 1.6) return "worried";
  if (rt < 1 && (!known || (trust >= 80 && morale >= 60))) return "thriving";
  return "calm";
}
