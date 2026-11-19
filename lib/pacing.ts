// Facilitator pacing recommendations (Release 1): the "Next up" card on the
// Command Center and the optional autopilot both read from this.
//
// Pure (no DB access) so the client can recompute it every second between
// polls and the server tick (lib/autopilot.ts) uses exactly the same rules.
//
// The schedule: the five narrative days (03-events.md's Monday-Friday acts)
// each take one fifth of the story. Within an act, its core-path events are
// spread evenly, so a three-event act fires roughly every 5 minutes of a
// 75-minute game. Positions are expressed as a fraction of the story rather
// than real minutes, so pausing and mid-game duration changes are handled
// for free by the narrative clock (lib/sim-clock.ts).
//
// Two real constraints shape what can actually fire:
// - Prerequisites (lib/chain.ts): an event can't fire until every
//   prerequisite is scored or closed for every team. When the scheduled
//   event is blocked, the recommender looks ahead to the next core event that
//   *can* fire, and says when the facilitator's scoring is the blocker.
// - Load: overlapping events are expected (at most two open per team is the
//   soft limit). Over the limit is a warning, never a block.
import { computeGameDaysElapsed, computeRealElapsedMs, type GlobalClockFields } from "./sim-clock";
import { NARRATIVE_DAYS } from "./game-day";

export const SOFT_MAX_OPEN_PER_TEAM = 2;
// "On track" tolerance either side of the schedule, in real minutes.
const ON_TRACK_TOLERANCE_MINUTES = 2;
// Minimum real minutes between required events when estimating whether the
// rest of the game still fits.
const MIN_GAP_MINUTES = 4;

export interface PacingEvent {
  id: string;
  title: string;
  day: number;
  isCorePath: boolean;
  suggestedTargetRegions: string[] | null;
}

export interface PacingDispatch {
  eventId: string;
  status: string;
  targetTeamId: number | null;
}

export interface PacingInput {
  events: PacingEvent[];
  dispatches: PacingDispatch[];
  chainStatus: Record<string, { ok: boolean; blockedBy: string[] }>;
  targetHints?: Record<string, string[]>;
  clock: GlobalClockFields;
  now?: number;
  // Release 5: the shared R&D fund reached its final milestone, so the
  // vaccine allocation event can be released ahead of its slot.
  researchReady?: boolean;
}

export interface Recommendation {
  eventId: string;
  title: string;
  isCorePath: boolean;
  // Real minutes until its scheduled slot; negative means overdue.
  dueInMinutes: number | null;
  reason: string;
  targetRegions: string[] | null;
}

export type PacingStatus = "not_started" | "on_track" | "behind" | "ahead" | "all_fired";

export interface PacingResult {
  status: PacingStatus;
  // Positive = behind schedule by this many real minutes; negative = ahead.
  minutesOffSchedule: number;
  storyProgressPct: number;
  currentAct: number;
  minutesRemaining: number;
  maxOpenPerTeam: number;
  next: Recommendation | null;
  // The scheduled event is blocked: why, and whether scoring is the fix.
  blockedNote: string | null;
  optional: Recommendation[];
  tips: string[];
  schedule: { eventId: string; fraction: number; fired: boolean }[];
  requiredRemaining: number;
}

function sortByDayThenId(a: PacingEvent, b: PacingEvent) {
  return a.day - b.day || a.id.localeCompare(b.id);
}

export function buildSchedule(events: PacingEvent[]): { event: PacingEvent; fraction: number }[] {
  const core = events.filter((e) => e.isCorePath).sort(sortByDayThenId);
  const out: { event: PacingEvent; fraction: number }[] = [];
  for (let day = 1; day <= NARRATIVE_DAYS; day++) {
    const inAct = core.filter((e) => e.day === day);
    inAct.forEach((event, i) => {
      out.push({ event, fraction: (day - 1 + i / inAct.length) / NARRATIVE_DAYS });
    });
  }
  return out;
}

function targetsFor(e: PacingEvent, hints: Record<string, string[]> | undefined): string[] | null {
  const hint = hints?.[e.id];
  if (hint && hint.length > 0) return hint;
  return e.suggestedTargetRegions && e.suggestedTargetRegions.length > 0 ? e.suggestedTargetRegions : null;
}

export function computePacing(input: PacingInput): PacingResult {
  const now = input.now ?? Date.now();
  const { clock } = input;
  const totalGameDays = clock.totalGameDays > 0 ? clock.totalGameDays : 90;
  const rate = clock.gameDaysPerRealMinute > 0 ? clock.gameDaysPerRealMinute : 1.5;
  const fractionToMinutes = (f: number) => (f * totalGameDays) / rate;

  const started = !!clock.simulationStartedAt;
  const progress = started ? Math.min(1, computeGameDaysElapsed(clock, computeRealElapsedMs(clock, now)) / totalGameDays) : 0;
  const currentAct = Math.min(NARRATIVE_DAYS, Math.floor(progress * NARRATIVE_DAYS) + 1);
  const minutesRemaining = fractionToMinutes(1 - progress);

  const firedIds = new Set(input.dispatches.map((d) => d.eventId));
  const schedule = buildSchedule(input.events);
  const pending = schedule.filter((s) => !firedIds.has(s.event.id));

  const openByTeam = new Map<number, number>();
  for (const d of input.dispatches) {
    if (d.status === "dispatched" && d.targetTeamId != null) openByTeam.set(d.targetTeamId, (openByTeam.get(d.targetTeamId) ?? 0) + 1);
  }
  const maxOpenPerTeam = Math.max(0, ...openByTeam.values());

  // Where we are against the schedule: the earliest unfired required slot.
  const firstPending = pending[0] ?? null;
  const minutesOffSchedule = firstPending ? fractionToMinutes(progress - firstPending.fraction) : 0;

  let status: PacingStatus;
  if (!started) status = "not_started";
  else if (!firstPending) status = "all_fired";
  else if (minutesOffSchedule > ON_TRACK_TOLERANCE_MINUTES) status = "behind";
  else {
    // Ahead means more required events fired than the schedule expects by now.
    const expected = schedule.filter((s) => s.fraction <= progress).length;
    const fired = schedule.length - pending.length;
    status = fired > expected ? "ahead" : "on_track";
  }

  // Recommend the earliest pending required event that can actually fire.
  const fireable = pending.find((s) => input.chainStatus[s.event.id]?.ok !== false) ?? null;
  let blockedNote: string | null = null;
  if (firstPending && fireable?.event.id !== firstPending.event.id) {
    const blockers = input.chainStatus[firstPending.event.id]?.blockedBy ?? [];
    const awaitingScore = blockers.filter((b) => input.dispatches.some((d) => d.eventId === b && d.status === "responded"));
    blockedNote =
      awaitingScore.length > 0
        ? `${firstPending.event.id} is waiting on you to score ${awaitingScore.join(", ")}.`
        : `${firstPending.event.id} is waiting on ${blockers.join(", ")} to finish for every team.`;
  }

  let next: Recommendation | null = null;
  if (fireable) {
    const dueInMinutes = fractionToMinutes(fireable.fraction - progress);
    const loadNote =
      maxOpenPerTeam >= SOFT_MAX_OPEN_PER_TEAM
        ? ` Teams already have ${maxOpenPerTeam} open event${maxOpenPerTeam === 1 ? "" : "s"}; firing now stacks another.`
        : "";
    const when = !started
      ? "First required event once you start."
      : dueInMinutes <= 0.5
        ? dueInMinutes < -ON_TRACK_TOLERANCE_MINUTES
          ? `Overdue by ${Math.round(-dueInMinutes)} min.`
          : "Due now."
        : `Due in ${Math.round(dueInMinutes)} min.`;
    next = {
      eventId: fireable.event.id,
      title: fireable.event.title,
      isCorePath: true,
      dueInMinutes: started ? dueInMinutes : null,
      reason: `Required event for Act ${fireable.event.day}. ${when}${loadNote}`,
      targetRegions: targetsFor(fireable.event, input.targetHints),
    };
  }

  // Optional events only when there's slack: not behind, the next required
  // event isn't imminent, and teams aren't already at the soft load limit.
  const optional: Recommendation[] = [];
  const hasSlack =
    started &&
    status !== "behind" &&
    maxOpenPerTeam < SOFT_MAX_OPEN_PER_TEAM &&
    (next?.dueInMinutes == null || next.dueInMinutes > MIN_GAP_MINUTES);
  if (hasSlack) {
    const candidates = input.events
      .filter((e) => !e.isCorePath && !firedIds.has(e.id) && e.day <= currentAct && input.chainStatus[e.id]?.ok !== false)
      .sort((a, b) => {
        // Events whose trigger the live game state currently satisfies first.
        const ha = input.targetHints?.[a.id]?.length ? 0 : 1;
        const hb = input.targetHints?.[b.id]?.length ? 0 : 1;
        return ha - hb || sortByDayThenId(a, b);
      });
    for (const e of candidates.slice(0, 3)) {
      const hint = input.targetHints?.[e.id];
      optional.push({
        eventId: e.id,
        title: e.title,
        isCorePath: false,
        dueInMinutes: null,
        reason:
          hint && hint.length > 0
            ? `${hint.join("/")} currently meet${hint.length === 1 ? "s" : ""} this event's trigger.`
            : `You have room before the next required event; fits Act ${e.day}.`,
        targetRegions: targetsFor(e, input.targetHints),
      });
    }
  }

  // Shared R&D delivered a countermeasure early: offer the vaccine event now.
  const EARLY_EVENT = "EVT-006";
  if (input.researchReady && started && !firedIds.has(EARLY_EVENT) && next?.eventId !== EARLY_EVENT) {
    const e = input.events.find((x) => x.id === EARLY_EVENT);
    if (e) {
      const blocked = input.chainStatus[EARLY_EVENT]?.ok === false;
      optional.unshift({
        eventId: e.id,
        title: e.title,
        isCorePath: e.isCorePath,
        dueInMinutes: null,
        reason: blocked
          ? `Research funding made doses available early, but it still waits on ${input.chainStatus[EARLY_EVENT].blockedBy.join(", ")}.`
          : "Research funding made doses available early; you can release this now instead of waiting for its slot.",
        targetRegions: targetsFor(e, input.targetHints),
      });
    }
  }

  const tips: string[] = [];
  if (status === "behind") {
    tips.push(`Behind by about ${Math.round(minutesOffSchedule)} min. Hold optional events until you catch up.`);
  }
  if (started && pending.length > 0) {
    const neededMinutes = (pending.length - 1) * MIN_GAP_MINUTES + 8;
    if (neededMinutes > minutesRemaining + ON_TRACK_TOLERANCE_MINUTES) {
      const shortBy = Math.ceil(neededMinutes - minutesRemaining);
      tips.push(
        `${pending.length} required event${pending.length === 1 ? "" : "s"} left in ~${Math.round(minutesRemaining)} min. Add about ${shortBy} min to the duration, or lower decision time.`
      );
    }
  }
  if (blockedNote && blockedNote.includes("score")) {
    tips.push("Scoring promptly keeps the next events unlocked.");
  }

  return {
    status,
    minutesOffSchedule,
    storyProgressPct: progress * 100,
    currentAct,
    minutesRemaining,
    maxOpenPerTeam,
    next,
    blockedNote,
    optional,
    tips,
    schedule: schedule.map((s) => ({ eventId: s.event.id, fraction: s.fraction, fired: firedIds.has(s.event.id) })),
    requiredRemaining: pending.length,
  };
}
