import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users, teams } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { createSession as lifecycleCreateSession } from "@/lib/session-lifecycle";
import type { Actor } from "@/lib/session-context";

export async function createTestUser(role: "student" | "instructor" = "instructor") {
  const [user] = await db
    .insert(users)
    .values({
      username: `test-${role}-${Math.random().toString(36).slice(2, 8)}`,
      displayUsername: `test-${role}`,
      passwordHash: await bcrypt.hash("password", 4),
      name: `Test ${role}`,
      role,
    })
    .returning();
  return user;
}

export async function createTestSession(mode: "instructor" | "demo" = "instructor") {
  const owner = await createTestUser("instructor");
  const sessionId = await lifecycleCreateSession(owner.id, mode);
  return { sessionId, ownerUserId: owner.id };
}

// Builds an Actor (lib/session-context.ts's shape) for direct calls into
// route handlers / lib functions in tests, bypassing the HTTP/auth layer —
// matches the plan's testing approach of mocking session-context rather than
// spinning up a real HTTP server.
export async function actorFor(sessionId: string, regionId: string, mode: "instructor" | "demo" = "instructor"): Promise<Actor> {
  const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.regionId, regionId)) });
  if (!team) throw new Error(`No team for region ${regionId} in session ${sessionId}`);
  return {
    sessionId,
    role: "student",
    teamId: team.id,
    regionId,
    userId: null,
    isOwner: false,
    mode,
  };
}

export async function instructorActorFor(sessionId: string, ownerUserId: number, mode: "instructor" | "demo" = "instructor"): Promise<Actor> {
  return {
    sessionId,
    role: "instructor",
    teamId: null,
    regionId: null,
    userId: ownerUserId,
    isOwner: true,
    mode,
  };
}
