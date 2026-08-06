import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users, sessionRegionCredentials, teams, gameSessions } from "./db/schema";
import { and, desc, eq, ne } from "drizzle-orm";
import { authConfig } from "./auth.config";
import { checkRateLimit, clientIpFrom } from "./rate-limit";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      name: string;
      kind: "user" | "region";
      role: "student" | "instructor";
      userId: number | null;
      sessionId: string | null;
      regionId: string | null;
      teamId: number | null;
    };
  }
}

// Resolves whether a public account currently owns an active (non-archived)
// game session — "instructor-ness" is a property of session ownership, not
// a fixed flag on the account (see lib/db/schema.ts's comment on
// users.role). Re-run at sign-in and whenever the client calls next-auth's
// update() — the intended trigger is right after POST /api/sessions
// succeeds, since role can only change by creating or losing a session.
interface AppTokenFields {
  kind: "user" | "region";
  username: string;
  name: string;
  role: "student" | "instructor";
  userId: number | null;
  sessionId: string | null;
  regionId: string | null;
  teamId: number | null;
}

async function resolveUserRole(userId: number): Promise<"student" | "instructor"> {
  const owned = await db.query.gameSessions.findFirst({
    where: and(eq(gameSessions.ownerUserId, userId), ne(gameSessions.status, "archived")),
    orderBy: desc(gameSessions.createdAt),
  });
  return owned ? "instructor" : "student";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const username = (credentials?.username as string)?.toLowerCase().trim();
        const password = credentials?.password as string;
        if (!username || !password) return null;

        const ip = clientIpFrom(request.headers);
        const allowed = await checkRateLimit(`${ip}:signin`);
        if (!allowed) return null;

        // 1. Public account (lib/db/schema.ts users).
        const user = await db.query.users.findFirst({ where: eq(users.username, username) });
        if (user) {
          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) return null;
          await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
          return {
            id: `user:${user.id}`,
            kind: "user" as const,
            userId: user.id,
            username: user.username,
            name: user.name,
          } as never;
        }

        // 2. Session-scoped region login (instructor mode, generated at
        // session creation — see lib/session-lifecycle.ts). Generated
        // usernames carry a random "-xxxxxx" suffix, so they can never
        // collide with a public account's username (registration also
        // rejects "-"-suffixed-looking names defensively — see
        // app/api/account/register/route.ts).
        const cred = await db.query.sessionRegionCredentials.findFirst({ where: eq(sessionRegionCredentials.username, username) });
        if (!cred) return null;
        const valid = await bcrypt.compare(password, cred.passwordHash);
        if (!valid) return null;
        const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, cred.sessionId), eq(teams.regionId, cred.regionId)) });
        if (!team) return null;

        return {
          id: `region:${cred.id}`,
          kind: "region" as const,
          username: cred.username,
          name: `${cred.regionId} Team`,
          sessionId: cred.sessionId,
          regionId: cred.regionId,
          teamId: team.id,
        } as never;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      const t = token as unknown as AppTokenFields;
      if (user) {
        const u = user as unknown as {
          kind: "user" | "region";
          username: string;
          name: string;
          userId?: number;
          sessionId?: string;
          regionId?: string;
          teamId?: number;
        };
        t.kind = u.kind;
        t.username = u.username;
        t.name = u.name;
        if (u.kind === "user") {
          t.userId = u.userId!;
          t.sessionId = null;
          t.regionId = null;
          t.teamId = null;
        } else {
          t.userId = null;
          t.sessionId = u.sessionId!;
          t.regionId = u.regionId!;
          t.teamId = u.teamId!;
        }
      }

      if (t.kind === "region") {
        t.role = "student";
      } else if (t.kind === "user" && (user || trigger === "update")) {
        t.role = await resolveUserRole(t.userId!);
      }

      return token;
    },
    session({ session, token }) {
      const t = token as unknown as AppTokenFields;
      session.user.id = t.kind === "user" ? `user:${t.userId}` : `region:${t.username}`;
      session.user.username = t.username;
      session.user.name = t.name;
      session.user.kind = t.kind;
      session.user.role = t.role;
      session.user.userId = t.userId ?? null;
      session.user.sessionId = t.sessionId ?? null;
      session.user.regionId = t.regionId ?? null;
      session.user.teamId = t.teamId ?? null;
      return session;
    },
  },
});
