// Opportunistic session reaping (Phase 5) — no new always-on service, no
// separate cron. Called from lib/deadline.ts's processDeadlines() tick, the
// same "things that happen automatically while a poll comes in" path every
// other passive subsystem uses, throttled by a single shared marker
// (reaperState) so it only actually scans every REAP_THROTTLE_MINUTES
// regardless of how many sessions are polling.
import { db } from "./db";
import { gameSessions, gameSessionSnapshots, reaperState } from "./db/schema";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import {
  REAP_ARCHIVE_IDLE_HOURS,
  REAP_DELETE_DEMO_AFTER_ARCHIVE_HOURS,
  REAP_DELETE_INSTRUCTOR_AFTER_ARCHIVE_HOURS,
  REAP_THROTTLE_MINUTES,
} from "./config";
import { deleteSession } from "./session-lifecycle";
import { logSessionEvent } from "./session-events";
import { captureFinalSnapshot } from "./session-snapshot";

export async function reapStale(): Promise<void> {
  // Ensure the singleton throttle row exists (first-ever call on a fresh
  // database), then claim it via the same atomic-conditional-UPDATE pattern
  // as every other tick throttle in this codebase (lib/deadline.ts's
  // lastTickAt). Losers (another poller already claimed this window) return
  // immediately.
  await db.insert(reaperState).values({ id: 1, lastReapAt: null }).onConflictDoNothing();
  const cutoff = new Date(Date.now() - REAP_THROTTLE_MINUTES * 60_000);
  const claimed = await db
    .update(reaperState)
    .set({ lastReapAt: new Date() })
    .where(and(eq(reaperState.id, 1), or(isNull(reaperState.lastReapAt), lt(reaperState.lastReapAt, cutoff))))
    .returning();
  if (claimed.length === 0) return;

  const now = Date.now();

  // Archive: running/paused sessions idle past the archive threshold.
  const archiveIdleCutoff = new Date(now - REAP_ARCHIVE_IDLE_HOURS * 3_600_000);
  const idleSessions = await db.query.gameSessions.findMany({
    where: and(or(eq(gameSessions.status, "running"), eq(gameSessions.status, "paused")), lt(gameSessions.lastActivityAt, archiveIdleCutoff)),
  });
  for (const s of idleSessions) {
    await db.update(gameSessions).set({ status: "archived", completedAt: s.completedAt ?? new Date() }).where(eq(gameSessions.id, s.id));
    await logSessionEvent({ sessionId: s.id, kind: "archived", mode: s.mode, detail: `idle since ${s.lastActivityAt.toISOString()}` });
  }

  // Delete: archived demo sessions past their (short) retention window —
  // nothing worth preserving. Archived instructor sessions get a much
  // longer window since a facilitator may want the debrief data.
  const demoDeleteCutoff = new Date(now - REAP_DELETE_DEMO_AFTER_ARCHIVE_HOURS * 3_600_000);
  const instructorDeleteCutoff = new Date(now - REAP_DELETE_INSTRUCTOR_AFTER_ARCHIVE_HOURS * 3_600_000);
  const archivedSessions = await db.query.gameSessions.findMany({ where: eq(gameSessions.status, "archived") });
  for (const s of archivedSessions) {
    const archivedAt = s.completedAt ?? s.lastActivityAt;
    const cutoffForMode = s.mode === "demo" ? demoDeleteCutoff : instructorDeleteCutoff;
    if (archivedAt < cutoffForMode) {
      // A safety net for a session that idled out rather than being
      // explicitly marked "completed" (see lib/session-snapshot.ts) — don't
      // overwrite a snapshot that already exists (it would clobber the
      // "completed" reason with "reaped", losing whether the instructor
      // actually finished it or the session just timed out).
      const existingSnapshot = await db.query.gameSessionSnapshots.findFirst({ where: eq(gameSessionSnapshots.sessionId, s.id) });
      if (!existingSnapshot) await captureFinalSnapshot(s.id, "reaped");
      await logSessionEvent({ sessionId: s.id, kind: "reaped", mode: s.mode, detail: `deleted after archive (${s.mode})` });
      await deleteSession(s.id);
    }
  }
}
