import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teams, teamNotifications, globalFeedItems, instructorActions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireInstructor } from "@/lib/api-helpers";
import { interjections } from "@/lib/db/seed-data/interjections";

// POST { interjectionId, targetRegionId: string | null } — targetRegionId
// null means the whole room (every team gets it, plus it's posted to the
// public feed since a room-wide beat is meant to be shared). A specific
// region gets it privately on their own dashboard only.
export async function POST(req: NextRequest) {
  const { session, error } = await requireInstructor();
  if (error) return error;

  const body = await req.json();
  const interjectionId = body.interjectionId as string;
  const targetRegionId = (body.targetRegionId as string | null | undefined) ?? null;

  const interjection = interjections.find((i) => i.id === interjectionId);
  if (!interjection) return NextResponse.json({ error: "Unknown interjection" }, { status: 404 });

  const message = `${interjection.title}: ${interjection.message}`;

  if (targetRegionId) {
    const team = await db.query.teams.findFirst({ where: eq(teams.regionId, targetRegionId) });
    if (!team) return NextResponse.json({ error: "Region not found" }, { status: 404 });
    await db.insert(teamNotifications).values({ teamId: team.id, kind: "interjection", message });
  } else {
    const allTeams = await db.query.teams.findMany();
    await db.insert(teamNotifications).values(allTeams.map((t) => ({ teamId: t.id, kind: "interjection", message })));
    await db.insert(globalFeedItems).values({ headlineText: message });
  }

  await db.insert(instructorActions).values({
    instructorUserId: Number(session!.user.id),
    actionType: "interjection_fired",
    targetDesc: `${interjection.title} -> ${targetRegionId ?? "all regions"}`,
  });

  return NextResponse.json({ ok: true });
}
