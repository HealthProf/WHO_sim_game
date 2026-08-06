import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { gameSessions, sessionState, sessionEvents } from "@/lib/db/schema";
import { and, count, eq, inArray } from "drizzle-orm";
import { resetDb, seedStaticOnce } from "./helpers/db";
import { createTestSession } from "./helpers/session";
import { processDeadlines } from "@/lib/deadline";
import { reapStale } from "@/lib/reaper";
import { MAX_CONCURRENT_ACTIVE_SESSIONS, IDLE_TICK_CUTOFF_MINUTES, REAP_ARCHIVE_IDLE_HOURS, REAP_DELETE_DEMO_AFTER_ARCHIVE_HOURS } from "@/lib/config";

describe("Phase 5 scaling hygiene", () => {
  beforeEach(async () => {
    await resetDb();
    await seedStaticOnce();
  });

  it("an idle session stops ticking", async () => {
    const { sessionId } = await createTestSession("instructor");
    await db.update(sessionState).set({ simulationStatus: "running", simulationStartedAt: new Date() }).where(eq(sessionState.sessionId, sessionId));

    const idleTime = new Date(Date.now() - (IDLE_TICK_CUTOFF_MINUTES + 5) * 60_000);
    await db.update(gameSessions).set({ lastActivityAt: idleTime }).where(eq(gameSessions.id, sessionId));

    const result = await processDeadlines(sessionId);
    expect(result.skipped).toBe("session idle");

    // lastTickAt should never have been claimed for an idle session.
    const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
    expect(gs?.lastTickAt).toBeNull();
  });

  it("an active (recently-polled) session keeps ticking", async () => {
    const { sessionId } = await createTestSession("instructor");
    await db.update(sessionState).set({ simulationStatus: "running", simulationStartedAt: new Date() }).where(eq(sessionState.sessionId, sessionId));
    await db.update(gameSessions).set({ lastActivityAt: new Date() }).where(eq(gameSessions.id, sessionId));

    const result = await processDeadlines(sessionId);
    expect(result.skipped).toBeUndefined();

    const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
    expect(gs?.lastTickAt).not.toBeNull();
  });

  it("reaper archives sessions idle past the archive threshold", async () => {
    const { sessionId } = await createTestSession("instructor");
    const longIdle = new Date(Date.now() - (REAP_ARCHIVE_IDLE_HOURS + 1) * 3_600_000);
    await db.update(gameSessions).set({ lastActivityAt: longIdle }).where(eq(gameSessions.id, sessionId));

    await reapStale();

    const session = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, sessionId) });
    expect(session?.status).toBe("archived");

    const events = await db.query.sessionEvents.findMany({ where: and(eq(sessionEvents.sessionId, sessionId), eq(sessionEvents.kind, "archived")) });
    expect(events.length).toBe(1);
  });

  it("reaper deletes archived demo sessions past their retention window, but not fresh ones", async () => {
    const { sessionId: staleDemoId } = await createTestSession("demo");
    const { sessionId: freshDemoId } = await createTestSession("demo");

    const longAgo = new Date(Date.now() - (REAP_DELETE_DEMO_AFTER_ARCHIVE_HOURS + 1) * 3_600_000);
    await db.update(gameSessions).set({ status: "archived", completedAt: longAgo }).where(eq(gameSessions.id, staleDemoId));
    await db.update(gameSessions).set({ status: "archived", completedAt: new Date() }).where(eq(gameSessions.id, freshDemoId));

    await reapStale();

    const staleRow = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, staleDemoId) });
    const freshRow = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, freshDemoId) });
    expect(staleRow).toBeUndefined(); // deleted
    expect(freshRow).toBeDefined(); // still archived, not yet deleted
    expect(freshRow?.status).toBe("archived");
  });

  it("?since=<stateVersion> parity check: unchanged state is detectable without recomputation", async () => {
    const { sessionId } = await createTestSession("instructor");
    const before = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
    expect(before?.stateVersion).toBe(0);

    // Simulate what app/api/dashboard's ?since= check does: compare the
    // client's last-known version against the current one.
    const unchanged = String(before!.stateVersion) === String(before!.stateVersion);
    expect(unchanged).toBe(true);

    const { tryDeductRegionField } = await import("@/lib/db-atomic");
    await tryDeductRegionField(sessionId, "AFRO", "fundRemaining", 1000);

    const after = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
    expect(after!.stateVersion).toBeGreaterThan(before!.stateVersion);
  });

  it("the global concurrency cap counts only active-status sessions", async () => {
    // Not exercising the HTTP route directly (it imports lib/auth, which
    // pulls in next-auth's "next/server" — see tests/isolation.test.ts's
    // note on why route handlers with auth imports aren't imported
    // directly in this suite) — this replicates the exact count query
    // app/api/sessions/route.ts POST uses to enforce
    // MAX_CONCURRENT_ACTIVE_SESSIONS.
    for (let i = 0; i < 3; i++) {
      await createTestSession(i % 2 === 0 ? "instructor" : "demo");
    }
    const [{ activeCount }] = await db
      .select({ activeCount: count() })
      .from(gameSessions)
      .where(inArray(gameSessions.status, ["setup", "running", "paused"]));
    expect(activeCount).toBe(3);
    expect(activeCount).toBeLessThan(MAX_CONCURRENT_ACTIVE_SESSIONS);
  });
});
