import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionState, instructorActions, gameSessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireInstructorActor } from "@/lib/session-context";
import { logSessionEvent } from "@/lib/session-events";
import { captureFinalSnapshot } from "@/lib/session-snapshot";

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

  const current = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  const now = new Date();

  const updates: Record<string, unknown> = { simulationStatus: status, updatedAt: now };

  if (status === "running") {
    if (!current?.simulationStartedAt) {
      updates.simulationStartedAt = now;
    } else if (current.pausedAt) {
      const pausedDurationMs = now.getTime() - new Date(current.pausedAt).getTime();
      updates.pausedAccumulatedMs = (current.pausedAccumulatedMs ?? 0) + pausedDurationMs;
      updates.pausedAt = null;
    }
  } else if (current?.simulationStartedAt && !current.pausedAt) {
    // Transitioning to paused/completed/not_started while the clock was
    // running — freeze it now.
    updates.pausedAt = now;
  }

  await db.update(sessionState).set(updates).where(eq(sessionState.sessionId, sessionId));

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
  }

  return NextResponse.json({ ok: true, status });
}
