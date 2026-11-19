// Shared "fire this event to these regions" path, used by POST /api/events
// (the facilitator's Dispatch button and the "Next up" card) and by the
// class-session autopilot (lib/autopilot.ts), so both create identical
// dispatch rows, deadlines, action-log entries, and announcements.
import { db } from "./db";
import { events, eventDispatches, instructorActions, teams } from "./db/schema";
import { eq } from "drizzle-orm";
import { canDispatch } from "./chain";
import { computeDeadlineAt } from "./deadline-window";
import { announceDispatch } from "./announcements";

export type DispatchResult =
  | { ok: true; dispatches: (typeof eventDispatches.$inferSelect)[] }
  | { ok: false; status: 404 | 409; error: string };

export async function dispatchEventToRegions(opts: {
  sessionId: string;
  eventId: string;
  // null/empty = every team in the session.
  targetRegionIds?: string[] | null;
  targetTeamId?: number | null;
  // users.id of whoever pressed the button; null for autopilot.
  dispatchedByUserId: number | null;
  // instructorActions.instructorUserId is a non-null FK, so automatic
  // dispatches are attributed to the session owner.
  actionUserId: number;
  actionType?: string;
  reason?: string | null;
}): Promise<DispatchResult> {
  const { sessionId, eventId } = opts;
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return { ok: false, status: 404, error: "Event not found" };

  const chain = await canDispatch(sessionId, eventId);
  if (!chain.ok) {
    return { ok: false, status: 409, error: `Blocked by unresolved prerequisite events: ${chain.blockedBy.join(", ")}` };
  }

  const dispatchedAt = new Date();
  const deadlineAt = await computeDeadlineAt(sessionId, eventId, dispatchedAt);

  const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });
  let targetIds: number[];
  if (opts.targetRegionIds && opts.targetRegionIds.length > 0) {
    targetIds = allTeams.filter((t) => opts.targetRegionIds!.includes(t.regionId)).map((t) => t.id);
  } else if (opts.targetTeamId) {
    targetIds = allTeams.filter((t) => t.id === opts.targetTeamId).map((t) => t.id);
  } else {
    targetIds = allTeams.map((t) => t.id);
  }

  const created =
    targetIds.length > 0
      ? await db
          .insert(eventDispatches)
          .values(
            targetIds.map((teamId) => ({
              sessionId,
              eventId,
              targetTeamId: teamId,
              dispatchedAt,
              deadlineAt,
              status: "dispatched" as const,
              dispatchedByUserId: opts.dispatchedByUserId,
            }))
          )
          .returning()
      : [];

  const audienceDesc =
    targetIds.length >= allTeams.length ? "all teams (global)" : `${targetIds.map((id) => allTeams.find((t) => t.id === id)?.regionId).join(", ")}`;
  await db.insert(instructorActions).values({
    sessionId,
    instructorUserId: opts.actionUserId,
    actionType: opts.actionType ?? "dispatch_event",
    targetDesc: `${eventId} -> ${audienceDesc}`,
    reason: opts.reason ?? null,
  });

  await announceDispatch({ sessionId, eventId, eventTitle: event.title, targetTeamIds: targetIds });

  return { ok: true, dispatches: created };
}
