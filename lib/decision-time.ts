// Live adjustments to open events' deadlines (Release 1), used by
// app/api/instructor/decision-time. Pulled out of the route so tests can
// exercise it without NextAuth. Every query is scoped to one session and only
// touches dispatches still awaiting a response with a future deadline; each
// write re-checks status so a dispatch answered or expired in between is left
// alone.
import { db } from "./db";
import { eventDispatches } from "./db/schema";
import { and, eq, gt } from "drizzle-orm";

async function openDispatches(sessionId: string, now: Date) {
  return db.query.eventDispatches.findMany({
    where: and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.status, "dispatched"), gt(eventDispatches.deadlineAt, now)),
  });
}

async function setDeadline(sessionId: string, dispatchId: number, deadlineAt: Date) {
  await db
    .update(eventDispatches)
    .set({ deadlineAt })
    .where(and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.id, dispatchId), eq(eventDispatches.status, "dispatched")));
}

// Scales the time *remaining* on each open event by ratio (new/old slider
// value), so moving the slider helps events teams are already working on.
export async function rescaleOpenDeadlines(sessionId: string, ratio: number, now: Date = new Date()): Promise<number> {
  if (!(ratio > 0) || Math.abs(ratio - 1) < 1e-6) return 0;
  let n = 0;
  for (const d of await openDispatches(sessionId, now)) {
    const remainingMs = d.deadlineAt!.getTime() - now.getTime();
    await setDeadline(sessionId, d.id, new Date(now.getTime() + remainingMs * ratio));
    n++;
  }
  return n;
}

export async function extendOpenDeadlines(sessionId: string, minutes: number, now: Date = new Date()): Promise<number> {
  let n = 0;
  for (const d of await openDispatches(sessionId, now)) {
    await setDeadline(sessionId, d.id, new Date(d.deadlineAt!.getTime() + minutes * 60_000));
    n++;
  }
  return n;
}
