import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { announcements } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { requireTeamActor } from "@/lib/session-context";
import { ackAnnouncement } from "@/lib/announcements";

// POST: a team dismisses one of its persistent popups (see
// lib/announcements.ts — team-scope announcements require an explicit close,
// unlike the transient global-display ones).
export async function POST(req: NextRequest) {
  const { actor, error } = await requireTeamActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json();
  const announcementId = Number(body.announcementId);

  const announcement = await db.query.announcements.findFirst({
    where: and(eq(announcements.sessionId, sessionId), eq(announcements.id, announcementId)),
  });
  if (!announcement) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await ackAnnouncement(sessionId, announcementId, actor!.teamId!);

  return NextResponse.json({ ok: true });
}
