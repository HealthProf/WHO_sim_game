import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionState, instructorActions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireInstructorActor } from "@/lib/session-context";
import { planDurationChange } from "@/lib/game-duration";
import { bumpStateVersion } from "@/lib/state-version";

// PATCH { minutes }: set the session's total play time (Release 1). Works
// before the game starts (just sets the pace) and mid-game (re-anchors the
// clock so the current in-game day doesn't jump, then paces the remaining
// days over the remaining minutes). Clamped server-side, see
// lib/game-duration.ts.
export async function PATCH(req: NextRequest) {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json().catch(() => ({}));
  const raw = Number(body.minutes);
  if (!Number.isFinite(raw) || raw <= 0) return NextResponse.json({ error: "minutes must be a positive number" }, { status: 400 });

  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  if (!gs) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const update = planDurationChange(gs, raw);
  await db.update(sessionState).set({ ...update, updatedAt: new Date() }).where(eq(sessionState.sessionId, sessionId));
  // Every client derives the clock locally from these fields, so make sure
  // ?since= pollers actually pick the change up.
  await bumpStateVersion(sessionId);
  await db.insert(instructorActions).values({
    sessionId,
    instructorUserId: actor!.userId!,
    actionType: "set_duration",
    targetDesc: `Game duration set to ${update.targetDurationMinutes} minutes of play`,
  });

  return NextResponse.json({ ok: true, ...update });
}
