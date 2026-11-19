import { NextRequest, NextResponse } from "next/server";
import { setSimulationStatus } from "@/lib/sim-status";
import { db } from "@/lib/db";
import { instructorActions, gameSessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireInstructorActor } from "@/lib/session-context";
import { logSessionEvent } from "@/lib/session-events";
import { captureFinalSnapshot } from "@/lib/session-snapshot";
import { clearSessionCredentialSecrets } from "@/lib/session-lifecycle";

// Start/pause/resume/complete/reopen the simulation. "Completed" is a soft,
// reversible state per simulation-docs/07-open-questions.md Q7 — never
// destructive, always re-openable if the class runs behind schedule.
//
// Also manages the simulation clock fields (see lib/sim-clock.ts):
// simulationStartedAt is set once, the first time the sim starts running.
// Any transition away from "running" (pause or complete) stamps pausedAt so
// the clock freezes; resuming folds the frozen duration into
// pausedAccumulatedMs so elapsed-time math stays correct across pauses.
export async function PATCH(req: NextRequest) {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json();
  const status = body.status as "not_started" | "running" | "paused" | "completed";

  await setSimulationStatus(sessionId, status);

  await db.insert(instructorActions).values({
    sessionId,
    instructorUserId: actor!.userId!,
    actionType: `simulation_${status}`,
    targetDesc: "session simulation state",
  });

  if (status === "completed") {
    const session = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, sessionId) });
    if (session) {
      await logSessionEvent({ sessionId, kind: "completed", mode: session.mode });
      await captureFinalSnapshot(sessionId, "completed");
    }
    await clearSessionCredentialSecrets(sessionId);
  }

  return NextResponse.json({ ok: true, status });
}
