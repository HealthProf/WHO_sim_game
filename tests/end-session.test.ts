import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { gameSessions, sessionRegionCredentials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resetDb, seedStaticOnce } from "./helpers/db";
import { createTestSession } from "./helpers/session";
import { endSession } from "@/lib/session-lifecycle";
import { verifyCredentials } from "@/lib/auth-verify";

// "End session and start new" (Release 1): ending must archive only the
// owner's own session, lock out its region logins, and leave any other
// session (another owner's, running concurrently) completely untouched.
describe("endSession", () => {
  beforeEach(async () => {
    await resetDb();
    await seedStaticOnce();
  });

  it("archives the owner's session and refuses its region logins afterwards", async () => {
    const { sessionId, ownerUserId } = await createTestSession("instructor");
    const cred = await db.query.sessionRegionCredentials.findFirst({ where: eq(sessionRegionCredentials.sessionId, sessionId) });
    const password = cred!.plaintextHint!;
    expect((await verifyCredentials(cred!.username, password)).outcome).toBe("ok");

    const ended = await endSession(sessionId, ownerUserId);
    expect(ended?.id).toBe(sessionId);

    const row = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, sessionId) });
    expect(row!.status).toBe("archived");
    expect((await verifyCredentials(cred!.username, password)).outcome).toBe("session-ended");
    const credAfter = await db.query.sessionRegionCredentials.findFirst({ where: eq(sessionRegionCredentials.id, cred!.id) });
    expect(credAfter!.plaintextHint).toBeNull();
  });

  it("is a no-op for a session the caller does not own, and leaves other sessions running", async () => {
    const a = await createTestSession("instructor");
    const b = await createTestSession("instructor");

    expect(await endSession(a.sessionId, b.ownerUserId)).toBeNull();
    const aRow = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, a.sessionId) });
    expect(aRow!.status).not.toBe("archived");

    await endSession(b.sessionId, b.ownerUserId);
    const aAfter = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, a.sessionId) });
    expect(aAfter!.status).not.toBe("archived");
    const bCred = await db.query.sessionRegionCredentials.findFirst({ where: eq(sessionRegionCredentials.sessionId, a.sessionId) });
    expect(bCred!.plaintextHint).toBeTruthy();
  });

  it("returns null when ending an already-ended session", async () => {
    const { sessionId, ownerUserId } = await createTestSession("demo");
    expect(await endSession(sessionId, ownerUserId)).not.toBeNull();
    expect(await endSession(sessionId, ownerUserId)).toBeNull();
  });
});
