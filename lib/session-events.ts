// Minimal observability log (Phase 5) — see lib/db/schema.ts's comment on
// sessionEvents for why sessionId is nullable and not FK'd.
import { db } from "./db";
import { sessionEvents } from "./db/schema";

export async function logSessionEvent(opts: {
  sessionId: string;
  kind: "created" | "completed" | "archived" | "reaped";
  mode: "instructor" | "demo";
  detail?: string;
}): Promise<void> {
  await db.insert(sessionEvents).values({
    sessionId: opts.sessionId,
    kind: opts.kind,
    mode: opts.mode,
    detail: opts.detail ?? null,
  });
}
