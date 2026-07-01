// Computes the in-game narrative day alongside real elapsed time. Pure math
// (no DB access) so it can run identically on the server (for API
// responses) and on the client (ticking every second between polls without
// waiting on the network).
//
// The narrative arc spans totalGameDays (default 90, ~3 months) compressed
// into a real session, advancing at gameDaysPerRealMinute (default 1.5, so
// 90 days / 60 real minutes). This is intentionally a *different* scale
// than fastModeMultiplier, which only governs individual event deadline
// windows — see lib/deadline.ts. At this compression, showing hour-of-day
// would be meaningless (each real second is ~36 in-game minutes), so the
// clock is day-level only, with a fractional progress-through-the-day value
// for a subtle progress indicator.

export interface GlobalClockFields {
  simulationStatus: string;
  simulationStartedAt: string | Date | null;
  pausedAccumulatedMs: number;
  pausedAt: string | Date | null;
  gameDaysPerRealMinute: number;
  totalGameDays: number;
}

export interface SimClock {
  running: boolean;
  realElapsedMs: number;
  gameDay: number;
  gameDayFraction: number; // 0-1 progress through the current game day
  totalGameDays: number;
}

export function computeRealElapsedMs(gs: GlobalClockFields, now: number = Date.now()): number {
  if (!gs.simulationStartedAt) return 0;
  const start = new Date(gs.simulationStartedAt).getTime();
  const frozenAt = gs.simulationStatus !== "running" && gs.pausedAt ? new Date(gs.pausedAt).getTime() : now;
  const elapsed = frozenAt - start - gs.pausedAccumulatedMs;
  return Math.max(0, elapsed);
}

export function computeSimClock(gs: GlobalClockFields, now: number = Date.now()): SimClock {
  const realElapsedMs = computeRealElapsedMs(gs, now);
  const realElapsedMinutes = realElapsedMs / 60000;
  const rate = gs.gameDaysPerRealMinute > 0 ? gs.gameDaysPerRealMinute : 1.5;
  const totalGameDays = gs.totalGameDays > 0 ? gs.totalGameDays : 90;

  const gameDaysElapsed = Math.min(realElapsedMinutes * rate, totalGameDays - 1 + 0.999999);
  const gameDay = 1 + Math.floor(gameDaysElapsed);
  const gameDayFraction = gameDaysElapsed - Math.floor(gameDaysElapsed);

  return {
    running: gs.simulationStatus === "running",
    realElapsedMs,
    gameDay,
    gameDayFraction,
    totalGameDays,
  };
}

// Converts a real-time duration (e.g. milliseconds remaining until a
// deadline) into the equivalent number of in-game days, using the same
// rate as the main clock — lets a countdown show both units together.
export function realMsToGameDays(ms: number, gameDaysPerRealMinute: number): number {
  return (ms / 60000) * gameDaysPerRealMinute;
}

export function formatRealElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatSimClock(clock: SimClock): string {
  return `Day ${clock.gameDay} of ~${clock.totalGameDays}`;
}

export function formatGameDays(days: number): string {
  if (days < 1) return `${Math.max(0, Math.round(days * 24))}h in-game`;
  return `${days.toFixed(1)}d in-game`;
}
