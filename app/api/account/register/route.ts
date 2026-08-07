import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { usernameError } from "@/lib/reserved-usernames";
import { generateSecret } from "@/lib/ids";
import { checkRateLimit, clientIpFrom } from "@/lib/rate-limit";

const bodySchema = z.object({
  username: z.string().min(3).max(32),
  name: z.string().min(1).max(100),
  email: z.string().email().max(200).optional().or(z.literal("")),
  institution: z.string().max(200).optional(),
});

// An uncaught throw in a route handler makes Next.js return a bare 500 with
// a zero-length body in production. The client can't parse that as JSON, so
// every server-side fault — including "the database schema was never pushed
// to this environment", which is what actually bit us — surfaced to the user
// as an indistinguishable "the server sent an unexpected response". Wrap the
// handler so faults are logged (visible in Vercel's runtime logs) and the
// client always gets a JSON body it can render.
export async function POST(req: NextRequest) {
  try {
    return await handleRegister(req);
  } catch (err) {
    console.error("POST /api/account/register failed:", err);
    return NextResponse.json(
      { error: "Registration is temporarily unavailable. Please try again shortly." },
      { status: 500 }
    );
  }
}

async function handleRegister(req: NextRequest) {
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

  const usernameIssue = usernameError(rawUsername);
  if (usernameIssue) {
    return NextResponse.json({ error: usernameIssue }, { status: 400 });
  }

  const username = rawUsername.toLowerCase().trim();

  // Always generate the password — there's no "set my own" option on
  // registration. The account can change it any time from the Account page.
  const generatedPassword = generateSecret(12);
  const passwordHash = await bcrypt.hash(generatedPassword, 10);

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
