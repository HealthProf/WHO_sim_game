import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionState, instructorActions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { rescaleOpenDeadlines, extendOpenDeadlines } from "@/lib/decision-time";
import { requireInstructorActor } from "@/lib/session-context";
import { DECISION_TIME_MAX_MULTIPLIER, DECISION_TIME_MIN_MULTIPLIER, EXTEND_OPEN_EVENTS_MINUTES } from "@/lib/config";
import { bumpStateVersion } from "@/lib/state-version";

// Facilitator's decision-time controls (Release 1), independent of Tempo.
//
// PATCH { multiplier }: sets how long future events stay open AND rescales
// the time left on every event that's open right now by new/old, so sliding
// toward "longer" when teams are rushing helps the events they're already on.
//
// POST {}: adds EXTEND_OPEN_EVENTS_MINUTES to every open event.
//
// Both only touch this session's dispatches (sessionId in every WHERE) and
// only ones still awaiting a response with a deadline in the future.

export async function PATCH(req: NextRequest) {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json().catch(() => ({}));
  const raw = Number(body.multiplier);
  if (!Number.isFinite(raw)) return NextResponse.json({ error: "multiplier must be a number" }, { status: 400 });
  const multiplier = Math.max(DECISION_TIME_MIN_MULTIPLIER, Math.min(DECISION_TIME_MAX_MULTIPLIER, raw));

  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  if (!gs) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const previous = gs.decisionTimeMultiplier > 0 ? gs.decisionTimeMultiplier : 1.0;

  await db.update(sessionState).set({ decisionTimeMultiplier: multiplier, updatedAt: new Date() }).where(eq(sessionState.sessionId, sessionId));

  const rescaled = await rescaleOpenDeadlines(sessionId, multiplier / previous);

  await bumpStateVersion(sessionId);
  await db.insert(instructorActions).values({
    sessionId,
    instructorUserId: actor!.userId!,
    actionType: "set_decision_time",
    targetDesc: `Decision time set to ${multiplier.toFixed(2)}x (${rescaled} open event${rescaled === 1 ? "" : "s"} rescaled)`,
  });

  return NextResponse.json({ ok: true, decisionTimeMultiplier: multiplier, rescaled });
}

export async function POST() {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const extended = await extendOpenDeadlines(sessionId, EXTEND_OPEN_EVENTS_MINUTES);

  await bumpStateVersion(sessionId);
  await db.insert(instructorActions).values({
    sessionId,
    instructorUserId: actor!.userId!,
    actionType: "extend_open_events",
    targetDesc: `Added ${EXTEND_OPEN_EVENTS_MINUTES} minutes to ${extended} open event${extended === 1 ? "" : "s"}`,
  });

  return NextResponse.json({ ok: true, extended });
}
