import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { coordinationMessages, teams, eventDispatches, globalFeedItems, teamNotifications } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { requireActor, requireTeamActor } from "@/lib/session-context";
import { COORDINATION_LEAK_CHANCE as LEAK_CHANCE } from "@/lib/config";
import { logAnalyticsEvent } from "@/lib/analytics";

// Coordination mechanism (05-product-requirements.md §6): broadcasts
// (toTeamId null) are a shared message board, visible to everyone. Targeted
// messages (toTeamId set) are item 6's diplomatic back-channel — genuinely
// private between the two regions involved, filtered out server-side for
// everyone else. The instructor still sees everything, since "did this team
// proactively coordinate" is itself part of the after-action assessment.
//
// A private message carries a small random chance of leaking (see
// LEAK_CHANCE below) — rolled once at send time, not on every read — which
// copies it to the public projector feed. That's the point: nothing in a
// crisis room is ever fully secure, and the threat of a leak is meant to
// shape what a team is actually willing to put in writing.

export async function GET() {
  const { actor, error } = await requireActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const allMessages = await db.query.coordinationMessages.findMany({
    where: eq(coordinationMessages.sessionId, sessionId),
    orderBy: desc(coordinationMessages.sentAt),
  });

  if (actor!.role === "instructor") {
    return NextResponse.json({ messages: allMessages });
  }

  const myTeamId = actor!.teamId;
  const visible = allMessages.filter((m) => m.toTeamId === null || m.fromTeamId === myTeamId || m.toTeamId === myTeamId || m.leaked);
  return NextResponse.json({ messages: visible });
}

export async function POST(req: NextRequest) {
  const { actor, error } = await requireTeamActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json();
  const toRegionId = (body.toRegionId as string | null | undefined) ?? null;
  const messageText = (body.messageText as string)?.trim();
  if (!messageText) return NextResponse.json({ error: "Message text is required" }, { status: 400 });
  if (toRegionId === actor!.regionId) {
    return NextResponse.json({ error: "Can't send a private channel message to your own region" }, { status: 400 });
  }
  const toTeam = toRegionId
    ? await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.regionId, toRegionId)) })
    : null;
  if (toRegionId && !toTeam) return NextResponse.json({ error: "Region not found" }, { status: 404 });
  const toTeamId = toTeam?.id ?? null;

  // The dispatch, if provided, must belong to this session — a client-
  // supplied eventDispatchId from another session must not be linkable.
  const eventDispatchId = body.eventDispatchId ? Number(body.eventDispatchId) : null;
  if (eventDispatchId != null) {
    const dispatch = await db.query.eventDispatches.findFirst({
      where: and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.id, eventDispatchId)),
    });
    if (!dispatch) return NextResponse.json({ error: "Dispatch not found" }, { status: 404 });
  }

  const willLeak = toTeamId !== null && Math.random() < LEAK_CHANCE;

  const [message] = await db
    .insert(coordinationMessages)
    .values({
      sessionId,
      fromTeamId: actor!.teamId!,
      toTeamId,
      eventDispatchId,
      messageText,
      leaked: willLeak,
    })
    .returning();

  if (willLeak) {
    const headline = `LEAK: a private channel between ${actor!.regionId} and ${toTeam?.regionId ?? "?"} was compromised — "${messageText}"`;
    await db.insert(globalFeedItems).values({ sessionId, headlineText: headline });
    const notifyTeamIds = [actor!.teamId, toTeamId].filter((id): id is number => id !== null);
    if (notifyTeamIds.length > 0) {
      await db.insert(teamNotifications).values(notifyTeamIds.map((teamId) => ({ sessionId, teamId, kind: "leak", message: headline })));
    }
  }

  // Deliberately no message content in the metadata — just shape (broadcast
  // vs. private, whether it leaked) so this stays action-and-path analytics,
  // not a copy of what teams actually said to each other.
  await logAnalyticsEvent({
    sessionId,
    mode: actor!.mode,
    eventType: "coordination_message_sent",
    actorRole: actor!.role,
    regionId: actor!.regionId,
    userId: actor!.userId,
    metadata: { broadcast: toTeamId === null, toRegionId, leaked: willLeak },
  });

  return NextResponse.json({ message, leaked: willLeak });
}
