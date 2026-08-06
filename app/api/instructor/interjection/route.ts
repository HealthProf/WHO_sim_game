import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, teamNotifications, globalFeedItems, instructorActions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { requireInstructorActor } from "@/lib/session-context";
import { interjections } from "@/lib/db/seed-data/interjections";

// POST { interjectionId, targetRegionId: string | null } — targetRegionId
// null means the whole room (every team gets it, plus it's posted to the
// public feed since a room-wide beat is meant to be shared). A specific
// region gets it privately on their own dashboard only. interjectionId is
// static seed content (lib/db/seed-data/interjections.ts), not a DB row, so
// it needs no session-ownership check — only targetRegionId, which is
// resolved against this session's own teams below.
export async function POST(req: NextRequest) {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json();
  const interjectionId = body.interjectionId as string;
  const targetRegionId = (body.targetRegionId as string | null | undefined) ?? null;

  const interjection = interjections.find((i) => i.id === interjectionId);
  if (!interjection) return NextResponse.json({ error: "Unknown interjection" }, { status: 404 });

  const message = `${interjection.title}: ${interjection.message}`;

  if (targetRegionId) {
    const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.regionId, targetRegionId)) });
    if (!team) return NextResponse.json({ error: "Region not found" }, { status: 404 });
    await db.insert(teamNotifications).values({ sessionId, teamId: team.id, kind: "interjection", message });
  } else {
    const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });
    await db.insert(teamNotifications).values(allTeams.map((t) => ({ sessionId, teamId: t.id, kind: "interjection", message })));
    await db.insert(globalFeedItems).values({ sessionId, headlineText: message });
  }

  await db.insert(instructorActions).values({
    sessionId,
    instructorUserId: actor!.userId!,
    actionType: "interjection_fired",
    targetDesc: `${interjection.title} -> ${targetRegionId ?? "all regions"}`,
  });

  return NextResponse.json({ ok: true });
}
