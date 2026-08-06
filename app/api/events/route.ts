import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { events, eventDispatches, instructorActions, globalFeedItems, teams } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { requireActor, requireInstructorActor } from "@/lib/session-context";
import { canDispatch, computeAllChainStatus } from "@/lib/chain";
import { computeDeadlineAt } from "@/lib/deadline";
import { announceDispatch } from "@/lib/announcements";
import { computeEventTargetHints } from "@/lib/event-targeting";

// GET: list all events with dispatch/chain status. Instructors see everything;
// students see only dispatches targeted at their team (or global broadcasts).
export async function GET() {
  const { actor, error } = await requireActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const allEvents = await db.query.events.findMany();
  const allDispatches = await db.query.eventDispatches.findMany({ where: eq(eventDispatches.sessionId, sessionId) });

  const chainStatus = await computeAllChainStatus(sessionId, allEvents.map((e) => e.id));

  if (actor!.role === "instructor") {
    const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });
    const targetHints = await computeEventTargetHints(sessionId);
    return NextResponse.json({
      events: allEvents,
      dispatches: allDispatches,
      chainStatus,
      teams: allTeams.map((t) => ({ id: t.id, regionId: t.regionId })),
      targetHints,
    });
  }

  const myDispatches = allDispatches.filter((d) => d.targetTeamId === actor!.teamId);
  return NextResponse.json({ events: allEvents, dispatches: myDispatches, chainStatus });
}

// POST: instructor dispatches an event to a specific team, a specific set of
// regions, or globally (one dispatch row per targeted team, per
// simulation-docs/06-data-model.md note on GLOBAL-scope events).
export async function POST(req: NextRequest) {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json();
  const eventId = body.eventId as string;
  const targetTeamId = body.targetTeamId as number | null | undefined; // single-team shorthand
  const targetRegionIds = body.targetRegionIds as string[] | null | undefined; // preferred: explicit region picker from the Control page

  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const chain = await canDispatch(sessionId, eventId);
  if (!chain.ok) {
    return NextResponse.json(
      { error: `Blocked by unresolved prerequisite events: ${chain.blockedBy.join(", ")}` },
      { status: 409 }
    );
  }

  const dispatchedAt = new Date();
  const deadlineAt = await computeDeadlineAt(sessionId, eventId, dispatchedAt);

  const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });
  // targetTeamId is resolved against this session's teams below (not trusted
  // directly) so a client-supplied id from another session can't be used to
  // dispatch into it.
  let targetIds: number[];
  if (targetRegionIds && targetRegionIds.length > 0) {
    targetIds = allTeams.filter((t) => targetRegionIds.includes(t.regionId)).map((t) => t.id);
  } else if (targetTeamId) {
    targetIds = allTeams.filter((t) => t.id === targetTeamId).map((t) => t.id);
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
              dispatchedByUserId: actor!.userId,
            }))
          )
          .returning()
      : [];

  const audienceDesc = targetIds.length >= allTeams.length ? "all teams (global)" : `${targetIds.map((id) => allTeams.find((t) => t.id === id)?.regionId).join(", ")}`;
  await db.insert(instructorActions).values({
    sessionId,
    instructorUserId: actor!.userId!,
    actionType: "dispatch_event",
    targetDesc: `${eventId} -> ${audienceDesc}`,
    reason: body.reason ?? null,
  });

  await announceDispatch({ sessionId, eventId, eventTitle: event.title, targetTeamIds: targetIds });

  return NextResponse.json({ dispatches: created });
}

// PATCH: push an already-dispatched event to the public display (facilitator
// action, distinct from dispatching it to teams — see design discussion on
// the public/private data boundary).
export async function PATCH(req: NextRequest) {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json();
  const dispatchId = body.dispatchId as number;
  const headline = body.headline as string;

  const dispatch = await db.query.eventDispatches.findFirst({
    where: and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.id, dispatchId)),
  });
  if (!dispatch) return NextResponse.json({ error: "Dispatch not found" }, { status: 404 });

  await db.update(eventDispatches).set({ revealedToPublic: true }).where(eq(eventDispatches.id, dispatchId));
  await db.insert(globalFeedItems).values({ sessionId, headlineText: headline, eventDispatchId: dispatchId });
  await db.insert(instructorActions).values({
    sessionId,
    instructorUserId: actor!.userId!,
    actionType: "push_to_global_display",
    targetDesc: `dispatch ${dispatchId}: ${headline}`,
  });

  return NextResponse.json({ ok: true });
}
