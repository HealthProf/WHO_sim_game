// Resolves "who is making this request, and which game session are they
// acting in" — the single place session identity is decided. No route may
// accept a sessionId from the client; it always comes from here.
//
// Identity now comes straight from the JWT (see lib/auth.ts): a "region"
// login carries its sessionId/regionId/teamId directly (baked in at sign-in,
// stable for that login's whole lifetime — a region credential's team never
// changes). A "user" login (public account) is the instructor for whichever
// game session it owns (gameSessions.ownerUserId) — resolved at sign-in and
// re-resolved via next-auth's update() right after session creation, not
// looked up fresh on every request, so this file trusts the JWT's role
// rather than re-querying "does this user own a session" itself.
import { auth } from "./auth";
import { db } from "./db";
import { gameSessions, teams } from "./db/schema";
import { and, desc, eq, ne } from "drizzle-orm";
import { NextResponse } from "next/server";

export interface Actor {
  sessionId: string;
  role: "instructor" | "student";
  teamId: number | null;
  regionId: string | null;
  userId: number | null;
  isOwner: boolean;
}

async function resolveActor(): Promise<Actor | null> {
  const authSession = await auth();
  const user = authSession?.user;
  if (!user) return null;

  if (user.kind === "region") {
    if (!user.sessionId || !user.teamId || !user.regionId) return null;
    await db.update(gameSessions).set({ lastActivityAt: new Date() }).where(eq(gameSessions.id, user.sessionId));
    return {
      sessionId: user.sessionId,
      role: "student",
      teamId: user.teamId,
      regionId: user.regionId,
      userId: null,
      isOwner: false,
    };
  }

  // kind === "user": the JWT's role is "instructor" only once resolveUserRole
  // (lib/auth.ts) found an owned, non-archived session at sign-in/update time.
  if (user.role !== "instructor" || !user.userId) return null;

  const owned = await db.query.gameSessions.findFirst({
    where: and(eq(gameSessions.ownerUserId, user.userId), ne(gameSessions.status, "archived")),
    orderBy: desc(gameSessions.createdAt),
  });
  if (!owned) return null;

  await db.update(gameSessions).set({ lastActivityAt: new Date() }).where(eq(gameSessions.id, owned.id));

  // Demo mode: the owner may be occupying a region rather than acting as
  // instructor — see gameSessions.demoActiveRegionId (Phase 4 wires the UI
  // that sets this; the resolution here is forward-compatible now).
  if (owned.mode === "demo" && owned.demoActiveRegionId) {
    const team = await db.query.teams.findFirst({
      where: and(eq(teams.sessionId, owned.id), eq(teams.regionId, owned.demoActiveRegionId)),
    });
    if (team) {
      return {
        sessionId: owned.id,
        role: "student",
        teamId: team.id,
        regionId: team.regionId,
        userId: user.userId,
        isOwner: true,
      };
    }
  }

  return {
    sessionId: owned.id,
    role: "instructor",
    teamId: null,
    regionId: null,
    userId: user.userId,
    isOwner: true,
  };
}

export async function requireActor(): Promise<{ actor: Actor | null; error: NextResponse | null }> {
  const actor = await resolveActor();
  if (!actor) {
    return { actor: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { actor, error: null };
}

export async function requireInstructorActor(): Promise<{ actor: Actor | null; error: NextResponse | null }> {
  const { actor, error } = await requireActor();
  if (error) return { actor: null, error };
  if (actor!.role !== "instructor") {
    return { actor: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { actor, error: null };
}

export async function requireTeamActor(): Promise<{ actor: Actor | null; error: NextResponse | null }> {
  const { actor, error } = await requireActor();
  if (error) return { actor: null, error };
  if (actor!.role !== "student" || actor!.teamId == null) {
    return { actor: null, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { actor, error: null };
}
