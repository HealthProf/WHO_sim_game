import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gameSessions, sessionRegionCredentials } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

// GET: re-render the credential sheet for a session this account owns.
// plaintextHint is retained specifically so this can be re-rendered
// mid-session (see lib/db/schema.ts's comment on sessionRegionCredentials)
// — cleared when the session completes, so this 404s (empty hints) after
// that point rather than leaking a stale password.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const session = await auth();
  if (!session?.user || session.user.kind !== "user" || !session.user.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const owned = await db.query.gameSessions.findFirst({
    where: and(eq(gameSessions.id, sessionId), eq(gameSessions.ownerUserId, session.user.userId)),
  });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const credentials = await db.query.sessionRegionCredentials.findMany({
    where: eq(sessionRegionCredentials.sessionId, sessionId),
    orderBy: (t, { asc }) => [asc(t.regionId)],
  });

  return NextResponse.json({
    session: { id: owned.id, mode: owned.mode, status: owned.status, displayToken: owned.displayToken },
    credentials: credentials.map((c) => ({ regionId: c.regionId, username: c.username, password: c.plaintextHint })),
  });
}
