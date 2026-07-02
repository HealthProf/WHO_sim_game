import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { ackAnnouncement } from "@/lib/announcements";

// POST: a team dismisses one of its persistent popups (see
// lib/announcements.ts — team-scope announcements require an explicit close,
// unlike the transient global-display ones).
export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (!session!.user.teamId) {
    return NextResponse.json({ error: "Only teams can dismiss announcements" }, { status: 403 });
  }

  const body = await req.json();
  const announcementId = Number(body.announcementId);
  await ackAnnouncement(announcementId, session!.user.teamId);

  return NextResponse.json({ ok: true });
}
