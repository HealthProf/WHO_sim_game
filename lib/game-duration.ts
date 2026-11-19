// Facilitator-adjustable total game duration (Release 1).
//
// The narrative clock (lib/sim-clock.ts) covers totalGameDays at
// gameDaysPerRealMinute. Rather than exposing that rate, the facilitator picks
// a total play time and the rate is derived from it. Changing the duration
// mid-game must not move the in-game day: we pin the current position as an
// anchor (clockAnchorElapsedMs / clockAnchorGameDays) and choose a new rate
// that spreads the *remaining* narrative days over the *remaining* minutes.
import { computeGameDaysElapsed, computeRealElapsedMs, type GlobalClockFields } from "./sim-clock";
import { DURATION_MAX_MINUTES, DURATION_MIN_MINUTES, DURATION_MIN_REMAINING_MINUTES } from "./config";

export function clampDurationMinutes(minutes: number): number {
  return Math.round(Math.max(DURATION_MIN_MINUTES, Math.min(DURATION_MAX_MINUTES, minutes)));
}

export function rateForDuration(totalGameDays: number, minutes: number): number {
  return totalGameDays / minutes;
}

export interface DurationUpdate {
  targetDurationMinutes: number;
  gameDaysPerRealMinute: number;
  clockAnchorElapsedMs: number;
  clockAnchorGameDays: number;
}

export function planDurationChange(gs: GlobalClockFields, requestedMinutes: number, now: number = Date.now()): DurationUpdate {
  const targetDurationMinutes = clampDurationMinutes(requestedMinutes);
  const totalGameDays = gs.totalGameDays > 0 ? gs.totalGameDays : 90;

  // Not started yet: plain single-rate clock, no anchor needed.
  if (!gs.simulationStartedAt) {
    return {
      targetDurationMinutes,
      gameDaysPerRealMinute: rateForDuration(totalGameDays, targetDurationMinutes),
      clockAnchorElapsedMs: 0,
      clockAnchorGameDays: 0,
    };
  }

  const elapsedMs = computeRealElapsedMs(gs, now);
  const daysElapsed = Math.min(computeGameDaysElapsed(gs, elapsedMs), totalGameDays);
  const remainingDays = totalGameDays - daysElapsed;
  const remainingMinutes = Math.max(DURATION_MIN_REMAINING_MINUTES, targetDurationMinutes - elapsedMs / 60000);
  const currentRate = gs.gameDaysPerRealMinute > 0 ? gs.gameDaysPerRealMinute : 1.5;

  return {
    targetDurationMinutes,
    // Story already finished: keep the old rate, nothing left to pace.
    gameDaysPerRealMinute: remainingDays > 0 ? remainingDays / remainingMinutes : currentRate,
    clockAnchorElapsedMs: Math.round(elapsedMs),
    clockAnchorGameDays: daysElapsed,
  };
}

// Minutes of play time the clock currently projects until the story ends,
// used by the Command Center to show "ends in ~N min".
export function projectedMinutesRemaining(gs: GlobalClockFields, now: number = Date.now()): number {
  const totalGameDays = gs.totalGameDays > 0 ? gs.totalGameDays : 90;
  const rate = gs.gameDaysPerRealMinute > 0 ? gs.gameDaysPerRealMinute : 1.5;
  const elapsedDays = computeGameDaysElapsed(gs, computeRealElapsedMs(gs, now));
  return Math.max(0, (totalGameDays - elapsedDays) / rate);
}
