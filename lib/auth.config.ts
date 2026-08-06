import type { NextAuthConfig } from "next-auth";

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

// Edge-safe subset of the auth config (no Credentials provider, no DB driver)
// used by middleware. The full config with the DB-backed Credentials
// provider lives in lib/auth.ts and only runs in the Node.js runtime.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
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
};
