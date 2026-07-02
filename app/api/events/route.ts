import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { events, eventDispatches, instructorActions, globalFeedItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireInstructor, requireSession } from "@/lib/api-helpers";
import { canDispatch, computeAllChainStatus } from "@/lib/chain";
import { computeDeadlineAt } from "@/lib/deadline";
import { announceDispatch } from "@/lib/announcements";
import { computeEventTargetHints } from "@/lib/event-targeting";

// GET: list all events with dispatch/chain status. Instructors see everything;
// students see only dispatches targeted at their team (or global broadcasts).
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const allEvents = await db.query.events.findMany();
  const allDispatches = await db.query.eventDispatches.findMany();

  const chainStatus = await computeAllChainStatus(allEvents.map((e) => e.id));

  if (session!.user.role === "instructor") {
    const allTeams = await db.query.teams.findMany();
    const targetHints = await computeEventTargetHints();
    return NextResponse.json({
      events: allEvents,
      dispatches: allDispatches,
      chainStatus,
      teams: allTeams.map((t) => ({ id: t.id, regionId: t.regionId })),
      targetHints,
    });
  }

  const myDispatches = allDispatches.filter((d) => d.targetTeamId === session!.user.teamId);
  return NextResponse.json({ events: allEvents, dispatches: myDispatches, chainStatus });
}

// POST: instructor dispatches an event to a specific team, a specific set of
// regions, or globally (one dispatch row per targeted team, per
// simulation-docs/06-data-model.md note on GLOBAL-scope events).
export async function POST(req: NextRequest) {
  const { session, error } = await requireInstructor();
  if (error) return error;

  const body = await req.json();
  const eventId = body.eventId as string;
  const targetTeamId = body.targetTeamId as number | null | undefined; // single-team shorthand
  const targetRegionIds = body.targetRegionIds as string[] | null | undefined; // preferred: explicit region picker from the Control page

  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const chain = await canDispatch(eventId);
  if (!chain.ok) {
    return NextResponse.json(
      { error: `Blocked by unresolved prerequisite events: ${chain.blockedBy.join(", ")}` },
      { status: 409 }
    );
  }

  const dispatchedAt = new Date();
  const deadlineAt = await computeDeadlineAt(eventId, dispatchedAt);

  const allTeams = await db.query.teams.findMany();
  let targetIds: number[];
  if (targetRegionIds && targetRegionIds.length > 0) {
    targetIds = allTeams.filter((t) => targetRegionIds.includes(t.regionId)).map((t) => t.id);
  } else if (targetTeamId) {
    targetIds = [targetTeamId];
  } else {
    targetIds = allTeams.map((t) => t.id);
  }

  const created =
    targetIds.length > 0
      ? await db
          .insert(eventDispatches)
          .values(
            targetIds.map((teamId) => ({
              eventId,
              targetTeamId: teamId,
              dispatchedAt,
              deadlineAt,
              status: "dispatched" as const,
              dispatchedByUserId: Number(session!.user.id),
            }))
          )
          .returning()
      : [];

  const audienceDesc = targetIds.length >= allTeams.length ? "all teams (global)" : `${targetIds.map((id) => allTeams.find((t) => t.id === id)?.regionId).join(", ")}`;
  await db.insert(instructorActions).values({
    instructorUserId: Number(session!.user.id),
    actionType: "dispatch_event",
    targetDesc: `${eventId} -> ${audienceDesc}`,
    reason: body.reason ?? null,
  });

  await announceDispatch({ eventId, eventTitle: event.title, targetTeamIds: targetIds });

  return NextResponse.json({ dispatches: created });
}

// PATCH: push an already-dispatched event to the public display (facilitator
// action, distinct from dispatching it to teams — see design discussion on
// the public/private data boundary).
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireInstructor();
  if (error) return error;

  const body = await req.json();
  const dispatchId = body.dispatchId as number;
  const headline = body.headline as string;

  const dispatch = await db.query.eventDispatches.findFirst({ where: eq(eventDispatches.id, dispatchId) });
  if (!dispatch) return NextResponse.json({ error: "Dispatch not found" }, { status: 404 });

  await db.update(eventDispatches).set({ revealedToPublic: true }).where(eq(eventDispatches.id, dispatchId));
  await db.insert(globalFeedItems).values({ headlineText: headline, eventDispatchId: dispatchId });
  await db.insert(instructorActions).values({
    instructorUserId: Number(session!.user.id),
    actionType: "push_to_global_display",
    targetDesc: `dispatch ${dispatchId}: ${headline}`,
  });

  return NextResponse.json({ ok: true });
}
