import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { events, eventDispatches, teams, instructorActions, globalFeedItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireInstructor, requireSession } from "@/lib/api-helpers";
import { canDispatch } from "@/lib/chain";
import { computeDeadlineAt } from "@/lib/deadline";

// GET: list all events with dispatch/chain status. Instructors see everything;
// students see only dispatches targeted at their team (or global broadcasts).
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const allEvents = await db.query.events.findMany();
  const allDispatches = await db.query.eventDispatches.findMany();

  const chainStatus: Record<string, { ok: boolean; blockedBy: string[] }> = {};
  for (const e of allEvents) {
    chainStatus[e.id] = await canDispatch(e.id);
  }

  if (session!.user.role === "instructor") {
    const allTeams = await db.query.teams.findMany();
    return NextResponse.json({
      events: allEvents,
      dispatches: allDispatches,
      chainStatus,
      teams: allTeams.map((t) => ({ id: t.id, regionId: t.regionId })),
    });
  }

  const myDispatches = allDispatches.filter((d) => d.targetTeamId === session!.user.teamId);
  return NextResponse.json({ events: allEvents, dispatches: myDispatches, chainStatus });
}

// POST: instructor dispatches an event to a specific team or globally (one
// dispatch row per team, per simulation-docs/06-data-model.md note on
// GLOBAL-scope events).
export async function POST(req: NextRequest) {
  const { session, error } = await requireInstructor();
  if (error) return error;

  const body = await req.json();
  const eventId = body.eventId as string;
  const targetTeamId = body.targetTeamId as number | null | undefined; // undefined/null = broadcast to all teams

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

  const targetIds = targetTeamId ? [targetTeamId] : (await db.query.teams.findMany()).map((t) => t.id);

  const created = [];
  for (const teamId of targetIds) {
    const [row] = await db
      .insert(eventDispatches)
      .values({
        eventId,
        targetTeamId: teamId,
        dispatchedAt,
        deadlineAt,
        status: "dispatched",
        dispatchedByUserId: Number(session!.user.id),
      })
      .returning();
    created.push(row);
  }

  await db.insert(instructorActions).values({
    instructorUserId: Number(session!.user.id),
    actionType: "dispatch_event",
    targetDesc: `${eventId} -> ${targetTeamId ? `team ${targetTeamId}` : "all teams (global)"}`,
    reason: body.reason ?? null,
  });

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
