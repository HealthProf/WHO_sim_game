import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionState, instructorActions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireInstructorActor } from "@/lib/session-context";
import { MIN_INTENSITY_MULTIPLIER as MIN_INTENSITY, MAX_INTENSITY_MULTIPLIER as MAX_INTENSITY } from "@/lib/config";

// Item 9's "drama dial" — see the schema comment on sessionState.intensityMultiplier
// for exactly what it scales. Clamped server-side regardless of what the
// client sends, so a stray value can't collapse deadline windows to zero or
// send drift/pricing into an unplayable spiral.
export async function PATCH(req: NextRequest) {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json();
  const raw = Number(body.intensityMultiplier);
  if (!Number.isFinite(raw)) return NextResponse.json({ error: "intensityMultiplier must be a number" }, { status: 400 });
  const intensityMultiplier = Math.max(MIN_INTENSITY, Math.min(MAX_INTENSITY, raw));

  await db.update(sessionState).set({ intensityMultiplier, updatedAt: new Date() }).where(eq(sessionState.sessionId, sessionId));
  await db.insert(instructorActions).values({
    sessionId,
    instructorUserId: actor!.userId!,
    actionType: "set_tempo",
    targetDesc: `Intensity multiplier set to ${intensityMultiplier.toFixed(2)}x`,
  });

  return NextResponse.json({ ok: true, intensityMultiplier });
}
