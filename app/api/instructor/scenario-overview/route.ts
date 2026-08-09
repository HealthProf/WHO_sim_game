import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionState } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireInstructorActor } from "@/lib/session-context";
import { bumpStateVersion } from "@/lib/state-version";

// Update 3, Class Session mode's manual trigger — the "Scenario Overview"
// button on the credential sheet (app/(public)/sessions/[id]/credentials).
// Demo mode never calls this: it starts the deck at session creation instead
// (lib/session-lifecycle.ts createSession), since demo has no login step for
// an instructor to press a button from. A reset (both modes) also (re)sets
// the same timestamp directly in app/api/instructor/reset/route.ts.
//
// sessionId always comes from the actor, never the client — see AGENTS.md's
// isolation invariant.
export async function POST() {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  await db.update(sessionState).set({ scenarioOverviewStartedAt: new Date(), updatedAt: new Date() }).where(eq(sessionState.sessionId, sessionId));
  await bumpStateVersion(sessionId);

  return NextResponse.json({ ok: true });
}
