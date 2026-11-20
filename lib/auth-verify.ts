// Credential-verification core used by lib/auth.ts's Credentials provider,
// pulled out into its own module so it can be exercised directly in tests
// without going through NextAuth's full HTTP sign-in flow (CSRF token +
// cookie jar per attempt) — see tests/auth-region-login.test.ts. Pure DB
// verification only; rate limiting stays in lib/auth.ts's authorize()
// because it needs the request's IP, which this module has no reason to see.
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users, sessionRegionCredentials, teams, gameSessions } from "./db/schema";
import { and, eq } from "drizzle-orm";

export interface VerifiedActor {
  id: string;
  kind: "user" | "region";
  userId?: number;
  sessionId?: string;
  regionId?: string;
  teamId?: number;
  username: string;
  name: string;
}

export type VerifyResult =
  | { outcome: "ok"; actor: VerifiedActor }
  // Wrong password, unknown username — the only outcome that should count
  // against the sign-in rate limit.
  | { outcome: "invalid" }
  // Credential and password check out, but the session/region has no teams
  // row (shouldn't happen outside a data-integrity problem) — not a guessed
  // credential, so the caller must not charge it against the rate limit.
  | { outcome: "region-missing-team" }
  // Correct region credential, but its session has been ended (archived) by
  // the facilitator. Not a guessed credential either, so it must not charge
  // the rate limit; the login is simply refused.
  | { outcome: "session-ended" };

export async function verifyCredentials(username: string, password: string): Promise<VerifyResult> {
  // 1. Public account (lib/db/schema.ts users).
  const user = await db.query.users.findFirst({ where: eq(users.username, username) });
  if (user) {
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return { outcome: "invalid" };
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
    return {
      outcome: "ok",
      actor: { id: `user:${user.id}`, kind: "user", userId: user.id, username: user.username, name: user.name },
    };
  }

  // 2. Session-scoped region login (instructor mode, generated at session
  // creation — see lib/session-lifecycle.ts). Generated usernames carry a
  // random "-xxxxxx" suffix, so they can never collide with a public
  // account's username (registration also rejects "-"-suffixed-looking
  // names defensively — see app/api/account/register/route.ts).
  const cred = await db.query.sessionRegionCredentials.findFirst({ where: eq(sessionRegionCredentials.username, username) });
  if (!cred) return { outcome: "invalid" };
  const valid = await bcrypt.compare(password, cred.passwordHash);
  if (!valid) return { outcome: "invalid" };
  const owningSession = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, cred.sessionId) });
  if (!owningSession || owningSession.status === "archived") return { outcome: "session-ended" };
  const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, cred.sessionId), eq(teams.regionId, cred.regionId)) });
  if (!team) return { outcome: "region-missing-team" };

  return {
    outcome: "ok",
    actor: {
      id: `region:${cred.id}`,
      kind: "region",
      username: cred.username,
      name: `${cred.regionId} Team`,
      sessionId: cred.sessionId,
      regionId: cred.regionId,
      teamId: team.id,
    },
  };
}
