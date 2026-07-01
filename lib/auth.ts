import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users, teams } from "./db/schema";
import { eq } from "drizzle-orm";
import { authConfig } from "./auth.config";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: "student" | "instructor";
      teamId: number | null;
      regionId: string | null;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = (credentials?.email as string)?.toLowerCase().trim();
        const password = credentials?.password as string;
        if (!email || !password) return null;

        const user = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        let regionId: string | null = null;
        if (user.teamId) {
          const team = await db.query.teams.findFirst({ where: eq(teams.id, user.teamId) });
          regionId = team?.regionId ?? null;
        }

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role: user.role,
          teamId: user.teamId,
          regionId,
        } as never;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as never as { role: string }).role;
        token.teamId = (user as never as { teamId: number | null }).teamId;
        token.regionId = (user as never as { regionId: string | null }).regionId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = String(token.id);
      session.user.role = token.role as "student" | "instructor";
      session.user.teamId = token.teamId as number | null;
      session.user.regionId = token.regionId as string | null;
      return session;
    },
  },
});
