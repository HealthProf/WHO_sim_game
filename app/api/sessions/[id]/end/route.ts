import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { endSession } from "@/lib/session-lifecycle";

// POST: end (archive) one of the caller's own sessions so a brand-new one of
// the same mode can be created from the sessions page. The id comes from the
// URL, but endSession() only matches a session this account owns, so a
// foreign or already-ended id is a 404, matching the convention for
// client-supplied ids elsewhere.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const session = await auth();
  if (!session?.user || session.user.kind !== "user" || !session.user.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ended = await endSession(sessionId, session.user.userId);
  if (!ended) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, sessionId: ended.id, mode: ended.mode });
}
