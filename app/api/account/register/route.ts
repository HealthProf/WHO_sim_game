import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { REGIONS } from "@/lib/regions";
import { generateSecret } from "@/lib/ids";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";

// Reserved usernames from the old fixed-login prototype — rejected outright,
// plus near-misses (non-alphanumeric characters stripped, lowercased) so
// "in-structor" or "AFRO!" can't sneak past a literal string comparison.
const RESERVED = new Set(["instructor", ...REGIONS.map((r) => r.toLowerCase())]);
function normalizeForReservedCheck(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const bodySchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(8).max(200).optional(), // omitted = generate one
  name: z.string().min(1).max(100),
  email: z.string().email().max(200).optional().or(z.literal("")),
  institution: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIpFrom(req.headers);
  const allowed = await checkRateLimit(`${ip}:register`);
  if (!allowed) {
    return NextResponse.json({ error: "Too many registration attempts. Try again later." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid registration details.", issues: parsed.error.issues }, { status: 400 });
  }
  const { username: rawUsername, name, email, institution } = parsed.data;

  if (rawUsername.includes("@")) {
    return NextResponse.json({ error: "Usernames can't contain \"@\" — that's reserved so region-login usernames (e.g. \"afro-7f3k9q\") never collide with a public account." }, { status: 400 });
  }
  if (rawUsername.includes("-")) {
    return NextResponse.json({ error: "Usernames can't contain \"-\" — that pattern is reserved for generated per-session region logins (e.g. \"afro-7f3k9q\")." }, { status: 400 });
  }
  if (RESERVED.has(normalizeForReservedCheck(rawUsername))) {
    return NextResponse.json({ error: "That username is reserved. Please choose another." }, { status: 400 });
  }

  const username = rawUsername.toLowerCase().trim();

  // Generate a strong password by default; the caller can supply their own
  // via the "set my own instead" toggle on the registration form.
  const generatedPassword = parsed.data.password ? null : generateSecret(12);
  const password = parsed.data.password ?? generatedPassword!;
  const passwordHash = await bcrypt.hash(password, 10);

  // No pre-check SELECT for an existing username — that was a second
  // sequential round trip to the DB before the INSERT, which on the Neon
  // HTTP driver (a full request/response cycle per query, worse on a
  // cold/suspended compute) was enough extra latency, stacked with the rest
  // of the route's queries, to occasionally blow past Vercel's function
  // timeout. users.username already has a unique constraint, so rely on
  // that and catch the violation instead.
  let user: typeof users.$inferSelect;
  try {
    [user] = await db
      .insert(users)
      .values({
        username,
        displayUsername: rawUsername,
        passwordHash,
        name,
        role: "student",
        email: email || null,
        institution: institution || null,
      })
      .returning();
  } catch (err) {
    // Drizzle wraps the raw driver error (which carries the Postgres error
    // code) in its own error object under `.cause` rather than exposing
    // `.code` directly — check both since we don't rely on which is used.
    const code =
      (err && typeof err === "object" && "code" in err && err.code) ||
      (err && typeof err === "object" && "cause" in err && err.cause && typeof err.cause === "object" && "code" in err.cause && err.cause.code);
    if (code === "23505") {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({
    user: { id: user.id, username: user.username, name: user.name },
    // Only returned once, at creation — never persisted in plaintext, and
    // never included in any later response. The client shows it exactly
    // once in a copy-to-clipboard field with a "no recovery without an
    // email" warning.
    generatedPassword,
  });
}
