import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { globalState, instructorActions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireInstructor } from "@/lib/api-helpers";

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
  const { session, error } = await requireInstructor();
  if (error) return error;

  const body = await req.json();
  const status = body.status as "not_started" | "running" | "paused" | "completed";

  const current = await db.query.globalState.findFirst({ where: eq(globalState.id, 1) });
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

  await db.update(globalState).set(updates).where(eq(globalState.id, 1));

  await db.insert(instructorActions).values({
    instructorUserId: Number(session!.user.id),
    actionType: `simulation_${status}`,
    targetDesc: "global simulation state",
  });

  return NextResponse.json({ ok: true, status });
}
