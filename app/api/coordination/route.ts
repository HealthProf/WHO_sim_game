import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { coordinationMessages, teams, globalFeedItems, teamNotifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/api-helpers";
import { COORDINATION_LEAK_CHANCE as LEAK_CHANCE } from "@/lib/config";

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
  const { session, error } = await requireSession();
  if (error) return error;

  const allMessages = await db.query.coordinationMessages.findMany({ orderBy: (t, { desc }) => [desc(t.sentAt)] });

  if (session!.user.role === "instructor") {
    return NextResponse.json({ messages: allMessages });
  }

  const myTeamId = session!.user.teamId;
  const visible = allMessages.filter((m) => m.toTeamId === null || m.fromTeamId === myTeamId || m.toTeamId === myTeamId || m.leaked);
  return NextResponse.json({ messages: visible });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (!session!.user.teamId) {
    return NextResponse.json({ error: "Only teams can post coordination messages" }, { status: 403 });
  }

  const body = await req.json();
  const toRegionId = (body.toRegionId as string | null | undefined) ?? null;
  const messageText = (body.messageText as string)?.trim();
  if (!messageText) return NextResponse.json({ error: "Message text is required" }, { status: 400 });
  if (toRegionId === session!.user.regionId) {
    return NextResponse.json({ error: "Can't send a private channel message to your own region" }, { status: 400 });
  }
  const toTeam = toRegionId ? await db.query.teams.findFirst({ where: eq(teams.regionId, toRegionId) }) : null;
  if (toRegionId && !toTeam) return NextResponse.json({ error: "Region not found" }, { status: 404 });
  const toTeamId = toTeam?.id ?? null;

  const willLeak = toTeamId !== null && Math.random() < LEAK_CHANCE;

  const [message] = await db
    .insert(coordinationMessages)
    .values({
      fromTeamId: session!.user.teamId,
      toTeamId,
      eventDispatchId: body.eventDispatchId ?? null,
      messageText,
      leaked: willLeak,
    })
    .returning();

  if (willLeak) {
    const headline = `LEAK: a private channel between ${session!.user.regionId} and ${toTeam?.regionId ?? "?"} was compromised — "${messageText}"`;
    await db.insert(globalFeedItems).values({ headlineText: headline });
    const notifyTeamIds = [session!.user.teamId, toTeamId].filter((id): id is number => id !== null);
    if (notifyTeamIds.length > 0) {
      await db.insert(teamNotifications).values(notifyTeamIds.map((teamId) => ({ teamId, kind: "leak", message: headline })));
    }
  }

  return NextResponse.json({ message, leaked: willLeak });
}
