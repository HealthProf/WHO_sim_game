import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gameSessions, sessionState } from "@/lib/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { REGIONS, type RegionId } from "@/lib/regions";
import { rateForDuration } from "@/lib/game-duration";
import { setSimulationStatus } from "@/lib/sim-status";
import { bumpStateVersion } from "@/lib/state-version";
import { CLASS_DECISION_WINDOW_BASE_MINUTES, SCENARIO_OVERVIEW_PREROLL_SECONDS } from "@/lib/config";

// Solo play setup and controls (Release 3). Owner-only, solo sessions only.
//
// POST { role: "facilitator" }
//   You run the facilitator console (fire events yourself, with the Next up
//   card and optional autopilot); the computer plays every region; you can
//   step into any region with the role switcher. Fast solo pacing, as before.
//
// POST { role: "region", regionId, durationMinutes? }
//   You play one region; the computer plays the facilitator and the other
//   five. Class-style decision windows (7-11 minutes) so there's time to read
//   and write, over a game length you choose (default 45 minutes). The game
//   starts immediately and the computer facilitator paces it.
//
// Role can only be chosen before the game starts.
//
// PATCH { action: "pause" | "resume" }
//   Lets the single-region player pause their game (they can't reach the
//   facilitator's controls).
// Shorter than 30 minutes can't fit 13 required events with 7-11 minute
// windows for one player.
const SOLO_REGION_DURATIONS = [30, 45, 60, 90];

async function ownedSolo(sessionId: string) {
  const session = await auth();
  if (!session?.user || session.user.kind !== "user" || !session.user.userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const owned = await db.query.gameSessions.findFirst({
    where: and(eq(gameSessions.id, sessionId), eq(gameSessions.ownerUserId, session.user.userId), ne(gameSessions.status, "archived")),
  });
  if (!owned || owned.mode !== "demo") return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { owned };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await ownedSolo(id);
  if ("error" in r) return r.error;

  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, id) });
  if (!gs) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (gs.simulationStartedAt) return NextResponse.json({ error: "This game has already started; start a new solo game to change roles." }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const overviewAt = new Date(Date.now() + SCENARIO_OVERVIEW_PREROLL_SECONDS * 1000);

  if (body.role === "facilitator") {
    await db.update(gameSessions).set({ soloRole: "facilitator", demoActiveRegionId: null }).where(eq(gameSessions.id, id));
    await db.update(sessionState).set({ computerFacilitator: false, scenarioOverviewStartedAt: overviewAt, updatedAt: new Date() }).where(eq(sessionState.sessionId, id));
    await bumpStateVersion(id);
    return NextResponse.json({ ok: true, landing: "/control" });
  }

  if (body.role === "region") {
    const regionId = body.regionId as RegionId;
    if (!REGIONS.includes(regionId)) return NextResponse.json({ error: "Pick a region" }, { status: 400 });
    const minutes = SOLO_REGION_DURATIONS.includes(Number(body.durationMinutes)) ? Number(body.durationMinutes) : 45;

    await db.update(gameSessions).set({ soloRole: "region", demoActiveRegionId: regionId }).where(eq(gameSessions.id, id));
    await db
      .update(sessionState)
      .set({
        computerFacilitator: true,
        targetDurationMinutes: minutes,
        gameDaysPerRealMinute: rateForDuration(gs.totalGameDays > 0 ? gs.totalGameDays : 90, minutes),
        clockAnchorElapsedMs: 0,
        clockAnchorGameDays: 0,
        // Same decision windows as a class session: there's one human
        // reading and writing, and the 40-word rationale applies to them.
        fastModeMultiplier: 1 / 60,
        decisionWindowBaseMinutes: CLASS_DECISION_WINDOW_BASE_MINUTES,
        scenarioOverviewStartedAt: overviewAt,
        updatedAt: new Date(),
      })
      .where(eq(sessionState.sessionId, id));
    // The computer facilitator runs the game, so it starts now.
    await setSimulationStatus(id, "running");
    await bumpStateVersion(id);
    return NextResponse.json({ ok: true, landing: "/dashboard" });
  }

  return NextResponse.json({ error: "role must be facilitator or region" }, { status: 400 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await ownedSolo(id);
  if ("error" in r) return r.error;
  if (r.owned.soloRole !== "region") return NextResponse.json({ error: "Use the Command page to pause a game you're facilitating." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, id) });
  if (!gs) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (body.action === "pause" && gs.simulationStatus === "running") await setSimulationStatus(id, "paused");
  else if (body.action === "resume" && gs.simulationStatus === "paused") await setSimulationStatus(id, "running");
  else return NextResponse.json({ error: "Nothing to change" }, { status: 409 });
  await bumpStateVersion(id);
  return NextResponse.json({ ok: true });
}
