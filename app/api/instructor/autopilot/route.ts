import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionState, instructorActions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireInstructorActor } from "@/lib/session-context";
import { bumpStateVersion } from "@/lib/state-version";

// PATCH { enabled }: turn the class-session autopilot on or off
// (lib/autopilot.ts). Class sessions only; demo sessions already have their
// own computer facilitator (lib/autoplayer/run.ts).
export async function PATCH(req: NextRequest) {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;
  if (actor!.mode !== "instructor") {
    const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
    if (gs?.computerFacilitator) return NextResponse.json({ error: "The computer is already running this game's events" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.enabled !== "boolean") return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });

  await db.update(sessionState).set({ autopilotEnabled: body.enabled, updatedAt: new Date() }).where(eq(sessionState.sessionId, sessionId));
  await bumpStateVersion(sessionId);
  await db.insert(instructorActions).values({
    sessionId,
    instructorUserId: actor!.userId!,
    actionType: "set_autopilot",
    targetDesc: `Autopilot ${body.enabled ? "on" : "off"}`,
  });
  return NextResponse.json({ ok: true, autopilotEnabled: body.enabled });
}
