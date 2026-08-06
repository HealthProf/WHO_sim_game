import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gameSessions } from "@/lib/db/schema";
import { and, desc, eq, ne } from "drizzle-orm";
import { createSession } from "@/lib/session-lifecycle";

// GET: sessions owned by the current public account (most recent first).
// Only kind="user" logins can own sessions.
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.kind !== "user" || !session.user.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const owned = await db.query.gameSessions.findMany({
    where: eq(gameSessions.ownerUserId, session.user.userId),
    orderBy: desc(gameSessions.createdAt),
  });
  return NextResponse.json({ sessions: owned });
}

// POST { mode }: "Run a session with my class" (instructor mode) or a demo
// session. Per-user caps (Phase 5, "1 active demo + 1 active instructor")
// aren't enforced yet — this refuses a second concurrent instructor session
// instead, which is the safe direction to err in before that lands.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.kind !== "user" || !session.user.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const mode = body.mode === "demo" ? "demo" : "instructor";

  const existingActive = await db.query.gameSessions.findFirst({
    where: and(eq(gameSessions.ownerUserId, session.user.userId), eq(gameSessions.mode, mode), ne(gameSessions.status, "archived")),
  });
  if (existingActive) {
    return NextResponse.json(
      { error: `You already have an active ${mode} session. Finish or archive it before starting another.`, sessionId: existingActive.id },
      { status: 409 }
    );
  }

  const sessionId = await createSession(session.user.userId, mode);
  return NextResponse.json({ sessionId });
}
