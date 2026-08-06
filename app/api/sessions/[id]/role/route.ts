import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gameSessions } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { REGIONS } from "@/lib/regions";

// PATCH { regionId: string | null }: the demo session owner switches which
// region they're occupying (null = act as instructor). Owner-only,
// demo-mode-only, a single atomic UPDATE — lib/session-context.ts's
// requireActor() reads gameSessions.demoActiveRegionId on every subsequent
// request to synthesize the effective actor, so this is the only place that
// column is ever written.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await params;
  const session = await auth();
  if (!session?.user || session.user.kind !== "user" || !session.user.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const regionId = body.regionId === null ? null : (body.regionId as string);
  if (regionId !== null && !REGIONS.includes(regionId as (typeof REGIONS)[number])) {
    return NextResponse.json({ error: "Invalid region" }, { status: 400 });
  }

  const owned = await db.query.gameSessions.findFirst({
    where: and(eq(gameSessions.id, sessionId), eq(gameSessions.ownerUserId, session.user.userId)),
  });
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (owned.mode !== "demo") return NextResponse.json({ error: "Role switching is only available in demo mode" }, { status: 400 });

  await db.update(gameSessions).set({ demoActiveRegionId: regionId }).where(eq(gameSessions.id, sessionId));

  return NextResponse.json({ ok: true, demoActiveRegionId: regionId });
}
