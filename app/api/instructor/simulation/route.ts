import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { globalState, instructorActions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireInstructor } from "@/lib/api-helpers";

// Start/pause/resume/complete/reopen the simulation. "Completed" is a soft,
// reversible state per simulation-docs/07-open-questions.md Q7 — never
// destructive, always re-openable if the class runs behind schedule.
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireInstructor();
  if (error) return error;

  const body = await req.json();
  const status = body.status as "not_started" | "running" | "paused" | "completed";

  await db.update(globalState).set({ simulationStatus: status, updatedAt: new Date() }).where(eq(globalState.id, 1));

  await db.insert(instructorActions).values({
    instructorUserId: Number(session!.user.id),
    actionType: `simulation_${status}`,
    targetDesc: "global simulation state",
  });

  return NextResponse.json({ ok: true, status });
}
