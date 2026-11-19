import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "./db";
import { gameSessions } from "./db/schema";
import { and, desc, eq, ne } from "drizzle-orm";
import { authConfig } from "./auth.config";
import { isRateLimited, consumeRateLimit, clearRateLimit, clientIpFrom } from "./rate-limit";
import { SIGNIN_MAX_ATTEMPTS_PER_CREDENTIAL, SIGNIN_IP_MAX_ATTEMPTS } from "./config";
import { verifyCredentials } from "./auth-verify";

// Distinct AuthError subclasses so the client can tell "you were rate
// limited" apart from "wrong username or password" (see app/login/page.tsx)
// instead of both collapsing into next-auth's generic CredentialsSignin.
// `code` ends up in the redirect URL's ?code= param, which next-auth's
// client-side signIn() surfaces back as res.code — see the "code" property's
// own doc comment on CredentialsSignin for why it must stay generic (never
// hint at *which* credential was rejected).
export class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

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
        const password = (credentials?.password as string)?.trim();
        if (!username || !password) return null;

        const ip = clientIpFrom(request.headers);
        const ipKey = `${ip}:signin`;
        const credentialKey = `${ip}:${username}:signin`;

        // Two independent budgets rather than one shared-key counter (see
        // lib/rate-limit.ts's header comment on isRateLimited/consumeRateLimit):
        // a tight per-credential ceiling that is the actual brute-force guard,
        // and a much looser per-IP ceiling that only resists one source trying
        // many different usernames. Both are read-only checks here — only a
        // failed attempt below ever writes to either counter, so a classroom
        // behind one shared IP signing in correctly never spends the budget.
        if (await isRateLimited(ipKey, SIGNIN_IP_MAX_ATTEMPTS)) throw new RateLimitedSignin();
        if (await isRateLimited(credentialKey, SIGNIN_MAX_ATTEMPTS_PER_CREDENTIAL)) throw new RateLimitedSignin();

        const result = await verifyCredentials(username, password);
        if (result.outcome === "invalid") {
          await consumeRateLimit(ipKey);
          await consumeRateLimit(credentialKey);
          return null;
        }
        // Password checked out but the region has no teams row — a
        // data-integrity edge case, not a guessed credential, so it must not
        // burn the caller's rate-limit budget.
        if (result.outcome === "region-missing-team" || result.outcome === "session-ended") return null;

        await clearRateLimit(credentialKey);
        return result.actor as never;
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
