import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { usernameError } from "@/lib/reserved-usernames";
import { checkRateLimit } from "@/lib/rate-limit";

// PATCH the current public account's username and/or password. Region
// logins (kind "region") have no users row of their own, so this 404s for
// them rather than 403 — same convention as GET/PATCH /api/account.
const bodySchema = z
  .object({
    currentPassword: z.string().min(1),
    newUsername: z.string().min(3).max(32).optional(),
    newPassword: z.string().min(8).max(200).optional(),
  })
  .refine((v) => v.newUsername !== undefined || v.newPassword !== undefined, {
    message: "Nothing to change.",
  });

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.kind !== "user" || !session.user.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const userId = session.user.userId;

  // Rate-limited per account rather than per IP — this endpoint checks a
  // caller-supplied password against the stored hash, same brute-force
  // surface as sign-in (lib/auth.ts), so it gets the same style of guard.
  const allowed = await checkRateLimit(`account:${userId}:credentials`);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { currentPassword, newUsername: rawUsername, newPassword } = parsed.data;

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
  }

  const updates: { username?: string; displayUsername?: string; passwordHash?: string } = {};

  if (rawUsername !== undefined) {
    const usernameIssue = usernameError(rawUsername);
    if (usernameIssue) {
      return NextResponse.json({ error: usernameIssue }, { status: 400 });
    }
    updates.username = rawUsername.toLowerCase().trim();
    updates.displayUsername = rawUsername;
  }
  if (newPassword !== undefined) {
    updates.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  try {
    await db.update(users).set(updates).where(eq(users.id, userId));
  } catch (err) {
    const code =
      (err && typeof err === "object" && "code" in err && err.code) ||
      (err && typeof err === "object" && "cause" in err && err.cause && typeof err.cause === "object" && "code" in err.cause && err.cause.code);
    if (code === "23505") {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true, username: updates.username ?? user.username });
}
