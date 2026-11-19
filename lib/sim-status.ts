// Simulation clock transitions (start / pause / resume / complete), moved
// out of app/api/instructor/simulation in Release 3 so the solo player who
// is playing a region (and so can't reach facilitator routes) can pause and
// resume through the same logic. See lib/sim-clock.ts for the fields:
// simulationStartedAt is set the first time the sim runs; leaving "running"
// stamps pausedAt so the clock freezes; resuming folds the paused duration
// into pausedAccumulatedMs.
import { db } from "./db";
import { sessionState } from "./db/schema";
import { eq } from "drizzle-orm";

export type SimStatus = "not_started" | "running" | "paused" | "completed";

export async function setSimulationStatus(sessionId: string, status: SimStatus, now: Date = new Date()): Promise<void> {
  const current = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
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
    updates.pausedAt = now;
  }

  await db.update(sessionState).set(updates).where(eq(sessionState.sessionId, sessionId));
}
