import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gameSessions, sessionState, instructorActions } from "@/lib/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { getRegionSetup, parseRegionSetup, saveRegionSetup } from "@/lib/region-setup";
import { planDurationChange } from "@/lib/game-duration";
import { bumpStateVersion } from "@/lib/state-version";

// Class-session setup (Release 3): which regions are player-run vs
// computer-run, and the game duration. Owner-only, class sessions only; the
// session id comes from the URL but must belong to the caller (404 if not).
async function ownedClassSession(sessionId: string) {
  const session = await auth();
  if (!session?.user || session.user.kind !== "user" || !session.user.userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const owned = await db.query.gameSessions.findFirst({
    where: and(eq(gameSessions.id, sessionId), eq(gameSessions.ownerUserId, session.user.userId), ne(gameSessions.status, "archived")),
  });
  if (!owned || owned.mode !== "instructor") return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { owned, userId: session.user.userId };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await ownedClassSession(id);
  if ("error" in r) return r.error;
  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, id) });
  return NextResponse.json({
    regions: await getRegionSetup(id),
    targetDurationMinutes: gs?.targetDurationMinutes ?? 75,
    started: !!gs?.simulationStartedAt,
  });
}

// PUT { regions: RegionSetup[], durationMinutes?: number }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await ownedClassSession(id);
  if ("error" in r) return r.error;

  const body = await req.json().catch(() => ({}));
  const setup = parseRegionSetup(body.regions);
  if (!setup) return NextResponse.json({ error: "regions must list each region with computer (true/false) and a profile" }, { status: 400 });
  if (setup.every((s) => s.computer)) {
    return NextResponse.json({ error: "At least one region needs to be player-run. For an all-computer game, use Solo play." }, { status: 400 });
  }
  await saveRegionSetup(id, setup);

  if (body.durationMinutes != null) {
    const minutes = Number(body.durationMinutes);
    const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, id) });
    if (gs && Number.isFinite(minutes) && minutes > 0) {
      await db.update(sessionState).set({ ...planDurationChange(gs, minutes), updatedAt: new Date() }).where(eq(sessionState.sessionId, id));
    }
  }
  await bumpStateVersion(id);

  const computer = setup.filter((s) => s.computer).map((s) => `${s.regionId} (${s.profile})`);
  await db.insert(instructorActions).values({
    sessionId: id,
    instructorUserId: r.userId,
    actionType: "region_setup",
    targetDesc: computer.length ? `Computer-run: ${computer.join(", ")}` : "All regions player-run",
  });
  return NextResponse.json({ ok: true, regions: await getRegionSetup(id) });
}
