// Phased feature unlock (Release 2 playtest request): in a class session,
// teams start with events only, then pledges and emergency funding open,
// then the WHO HQ marketplace and region-to-region trades, so the first
// rounds are about learning the event loop rather than every panel at once.
// Solo play keeps everything open. The facilitator can open everything early
// (sessionState.featuresUnlockedEarly).
//
// Counted in distinct events fired in the session, so it tracks how far the
// game has actually progressed rather than the clock.
import { UNLOCK_MARKET_AFTER_EVENTS, UNLOCK_PLEDGES_AFTER_EVENTS } from "./config";

export type GatedFeature = "pledges" | "market";

export interface FeatureUnlockState {
  open: boolean;
  // Events that must still be fired before it opens (0 when open).
  eventsUntilOpen: number;
  message: string | null;
}

export function computeFeatureUnlocks(opts: {
  mode: "instructor" | "demo";
  featuresUnlockedEarly: boolean;
  firedEventCount: number;
}): Record<GatedFeature, FeatureUnlockState> {
  const state = (threshold: number, what: string): FeatureUnlockState => {
    if (opts.mode === "demo" || opts.featuresUnlockedEarly || opts.firedEventCount >= threshold) {
      return { open: true, eventsUntilOpen: 0, message: null };
    }
    const left = threshold - opts.firedEventCount;
    return {
      open: false,
      eventsUntilOpen: left,
      message: `${what} opens after ${threshold} events have been released (${left} more to go). Focus on your events for now.`,
    };
  };
  return {
    pledges: state(UNLOCK_PLEDGES_AFTER_EVENTS, "Pledges & Funding"),
    market: state(UNLOCK_MARKET_AFTER_EVENTS, "The marketplace"),
  };
}
