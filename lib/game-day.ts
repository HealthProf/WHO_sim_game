// Maps each event's seeded narrative day (1-5, from 03-events.md's Monday-
// Friday structure) onto the wider game-day scale the clock now runs on
// (see lib/sim-clock.ts). Purely a display mapping — dispatch is manual and
// this doesn't gate anything, it just gives the instructor a sense of where
// each event sits across the full compressed arc instead of a cramped 1-5.
const NARRATIVE_DAYS = 5;

export function mapNarrativeDayToGameDay(narrativeDay: number, totalGameDays = 90): number {
  if (NARRATIVE_DAYS <= 1) return 1;
  const fraction = (narrativeDay - 1) / (NARRATIVE_DAYS - 1);
  return Math.round(1 + fraction * (totalGameDays - 1));
}
