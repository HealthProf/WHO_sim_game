// Pure (no DB) so client components can show "events get N minutes" previews.
// Real minutes a team gets for an event with the given stated deadline hours.
// Release 1: decoupled from the Tempo dial (intensityMultiplier) so the
// facilitator's decision-time slider is the single control over how long
// teams have to read, discuss, and write. See the schema comment on
// sessionState.decisionWindowBaseMinutes for the formula's parts.
export function decisionWindowMinutes(
  deadlineWindowHours: number,
  gs: { fastModeMultiplier?: number | null; decisionWindowBaseMinutes?: number | null; decisionTimeMultiplier?: number | null } | undefined
): number {
  const perHour = (gs?.fastModeMultiplier ?? 1 / 60) * 60;
  const base = gs?.decisionWindowBaseMinutes ?? 0;
  const scale = gs?.decisionTimeMultiplier && gs.decisionTimeMultiplier > 0 ? gs.decisionTimeMultiplier : 1.0;
  return (base + deadlineWindowHours * perHour) * scale;
}
