import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gameSessions } from "@/lib/db/schema";
import { and, eq, ne } from "drizzle-orm";

// POST: make this session the one the owner is acting in.
//
// An account can hold one active session per mode, and lib/session-context.ts
// resolveActor() picks between them by lastActivityAt (most recently used
// wins). Bumping it here is what "switch mode" actually does — deliberately
// selecting the other session rather than archiving either, so a class
// session survives a detour into the solo demo and vice versa.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const session = await auth();
  if (!session?.user || session.user.kind !== "user" || !session.user.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ownership is verified in the same statement that mutates, so a session id
  // belonging to somebody else can never be activated — 404 rather than 403,
  // matching the convention for client-supplied ids elsewhere.
  const [activated] = await db
    .update(gameSessions)
    .set({ lastActivityAt: new Date() })
    .where(
      and(
        eq(gameSessions.id, sessionId),
        eq(gameSessions.ownerUserId, session.user.userId),
        ne(gameSessions.status, "archived")
      )
    )
    .returning();

  if (!activated) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ sessionId: activated.id, mode: activated.mode });
}
