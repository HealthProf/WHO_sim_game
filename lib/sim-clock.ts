// Computes the in-game simulated day/time alongside real elapsed time. Pure
// math (no DB access) so it can run identically on the server (for API
// responses) and on the client (ticking every second between polls without
// waiting on the network).
//
// The narrative arc (simulation-docs/01-scenario.md) is a 5-day week
// starting Day 1, 08:00. fastModeMultiplier compresses that into a real
// session: real_minutes = sim_hours * 60 * fastModeMultiplier, so
// sim_hours = real_minutes / (60 * fastModeMultiplier). At the seeded
// default of 1/60, that's 1 simulated hour per 1 real minute (60x).

export interface GlobalClockFields {
  simulationStatus: string;
  simulationStartedAt: string | Date | null;
  pausedAccumulatedMs: number;
  pausedAt: string | Date | null;
  fastModeMultiplier: number;
}

export interface SimClock {
  running: boolean;
  realElapsedMs: number;
  simDay: number;
  simHour: number;
  simMinute: number;
}

const ORIGIN_HOUR = 8; // Day 1 begins at 08:00 per the scenario doc

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
  const multiplier = gs.fastModeMultiplier > 0 ? gs.fastModeMultiplier : 1 / 60;
  const simHoursElapsed = realElapsedMinutes / (60 * multiplier);

  const totalHours = ORIGIN_HOUR + simHoursElapsed;
  const simDay = 1 + Math.floor(totalHours / 24);
  const hourOfDay = ((totalHours % 24) + 24) % 24;
  const simHour = Math.floor(hourOfDay);
  const simMinute = Math.floor((hourOfDay - simHour) * 60);

  return {
    running: gs.simulationStatus === "running",
    realElapsedMs,
    simDay,
    simHour,
    simMinute,
  };
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
  const pad = (n: number) => String(n).padStart(2, "0");
  return `Day ${clock.simDay}, ${pad(clock.simHour)}:${pad(clock.simMinute)}`;
}
