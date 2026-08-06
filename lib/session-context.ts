// Resolves "who is making this request, and which game session are they
// acting in" — the single place session identity is decided. No route may
// accept a sessionId from the client; it always comes from here.
//
// Phase 1 note: this resolves session identity from the existing JWT (role,
// teamId, regionId) via the now-session-scoped `teams` row (student) or the
// session the user owns (instructor). Phase 3 replaces the student path with
// a direct sessionId carried on the JWT once session-scoped region logins
// exist (lib/auth.ts's second Credentials resolution branch), and Phase 4
// adds the demo-mode `demoActiveRegionId` override mentioned below. Both are
// additive to the Actor shape, not a rewrite of it.
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

  const userId = Number(user.id);

  if (user.role === "instructor") {
    const [owned] = await db
      .select()
      .from(gameSessions)
      .where(and(eq(gameSessions.ownerUserId, userId), ne(gameSessions.status, "archived")))
      .orderBy(desc(gameSessions.createdAt))
      .limit(1);
    if (!owned) return null;

    await db
      .update(gameSessions)
      .set({ lastActivityAt: new Date() })
      .where(eq(gameSessions.id, owned.id));

    // Demo mode: the owner may be occupying a region rather than acting as
    // instructor — see gameSessions.demoActiveRegionId (Phase 4 wires the
    // UI that sets this; the resolution here is forward-compatible now).
    if (owned.mode === "demo" && owned.demoActiveRegionId) {
      const [team] = await db
        .select()
        .from(teams)
        .where(and(eq(teams.sessionId, owned.id), eq(teams.regionId, owned.demoActiveRegionId)))
        .limit(1);
      if (team) {
        return {
          sessionId: owned.id,
          role: "student",
          teamId: team.id,
          regionId: team.regionId,
          userId,
          isOwner: true,
        };
      }
    }

    return {
      sessionId: owned.id,
      role: "instructor",
      teamId: null,
      regionId: null,
      userId,
      isOwner: true,
    };
  }

  if (!user.teamId) return null;
  const [team] = await db.select().from(teams).where(eq(teams.id, user.teamId)).limit(1);
  if (!team) return null;

  await db
    .update(gameSessions)
    .set({ lastActivityAt: new Date() })
    .where(eq(gameSessions.id, team.sessionId));

  return {
    sessionId: team.sessionId,
    role: "student",
    teamId: team.id,
    regionId: team.regionId,
    userId,
    isOwner: false,
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
