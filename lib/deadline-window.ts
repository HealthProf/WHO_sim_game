// Split out of lib/deadline.ts so lib/autoplayer/run.ts (which needs this
// for auto-dispatch) doesn't create a circular import with deadline.ts
// (which imports runAutoplayer). Re-exported from lib/deadline.ts so
// existing importers are unaffected.
import { db } from "./db";
import { events, sessionState } from "./db/schema";
import { eq } from "drizzle-orm";

export async function computeDeadlineAt(sessionId: string, eventId: string, dispatchedAt: Date): Promise<Date | null> {
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event || event.deadlineType === "NONE" || event.deadlineWindowHours == null) return null;

  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  const multiplier = gs?.fastModeMultiplier ?? 1;
  const intensity = gs?.intensityMultiplier && gs.intensityMultiplier > 0 ? gs.intensityMultiplier : 1.0;
  const windowMinutes = (event.deadlineWindowHours * 60 * multiplier) / intensity;
  return new Date(dispatchedAt.getTime() + windowMinutes * 60_000);
}
