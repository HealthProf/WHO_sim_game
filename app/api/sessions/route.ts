import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gameSessions } from "@/lib/db/schema";
import { and, count, desc, eq, inArray, ne } from "drizzle-orm";
import { createSession } from "@/lib/session-lifecycle";
import { MAX_CONCURRENT_ACTIVE_SESSIONS } from "@/lib/config";

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
// session. Per-user: at most one active session per mode — reuses/refuses
// rather than silently destroying an existing one. Global: a hard ceiling
// (MAX_CONCURRENT_ACTIVE_SESSIONS) so a traffic spike degrades to a "the
// demo is busy, try again shortly" response instead of exhausting Neon's
// free-tier connection limits.
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

  const [{ activeCount }] = await db
    .select({ activeCount: count() })
    .from(gameSessions)
    .where(inArray(gameSessions.status, ["setup", "running", "paused"]));
  if (activeCount >= MAX_CONCURRENT_ACTIVE_SESSIONS) {
    return NextResponse.json(
      { error: "The demo is busy right now — please try again in a few minutes." },
      { status: 503 }
    );
  }

  const sessionId = await createSession(session.user.userId, mode);
  return NextResponse.json({ sessionId });
}
