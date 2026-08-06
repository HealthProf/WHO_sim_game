import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

// GET/PATCH the current public account's optional profile fields. Region
// logins (kind "region") have no users row of their own, so both methods
// 404 for them rather than 403 — there's nothing to confirm exists.
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.kind !== "user" || !session.user.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, session.user.userId) });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    account: { username: user.username, name: user.name, email: user.email, institution: user.institution },
  });
}

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().max(200).optional().or(z.literal("")),
  institution: z.string().max(200).optional().or(z.literal("")),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.kind !== "user" || !session.user.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid profile details." }, { status: 400 });

  const updates: Record<string, string | null> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.email !== undefined) updates.email = parsed.data.email || null;
  if (parsed.data.institution !== undefined) updates.institution = parsed.data.institution || null;

  await db.update(users).set(updates).where(eq(users.id, session.user.userId));
  return NextResponse.json({ ok: true });
}
