import type { NextAuthConfig } from "next-auth";

// Edge-safe subset of the auth config (no Credentials provider, no DB driver)
// used by middleware. The full config with the DB-backed Credentials
// provider lives in lib/auth.ts and only runs in the Node.js runtime.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    session({ session, token }) {
      session.user.id = String(token.id);
      session.user.username = token.username as string;
      session.user.role = token.role as "student" | "instructor";
      session.user.teamId = token.teamId as number | null;
      session.user.regionId = token.regionId as string | null;
      return session;
    },
  },
};
