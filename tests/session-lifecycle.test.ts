import { describe, expect, it, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { sessionRegionCredentials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resetDb, seedStaticOnce } from "./helpers/db";
import { createTestSession } from "./helpers/session";
import { clearSessionCredentialSecrets } from "@/lib/session-lifecycle";
import { REGIONS } from "@/lib/regions";

// Bonus fix from the 4e investigation: sessionRegionCredentials.plaintextHint
// and the credential sheet's "(cleared after the session completed)"
// display fallback both documented that the plaintext password is cleared
// once a session completes, but nothing ever actually nulled the column —
// plaintext region passwords persisted for the life of the row. Fixed by
// PATCH /api/instructor/simulation calling clearSessionCredentialSecrets on
// the transition to "completed" (see that route and lib/session-lifecycle.ts
// for why the clearing logic is pulled out into its own function rather
// than tested via the route directly — the same next-auth/"next/server"
// import constraint documented in tests/cheat-codes.test.ts).
describe("clearSessionCredentialSecrets", () => {
  beforeEach(async () => {
    await resetDb();
    await seedStaticOnce();
  });

  it("nulls every region's plaintextHint without touching passwordHash", async () => {
    const { sessionId } = await createTestSession("instructor");
    const before = await db.query.sessionRegionCredentials.findMany({ where: eq(sessionRegionCredentials.sessionId, sessionId) });
    expect(before).toHaveLength(REGIONS.length);
    expect(before.every((c) => c.plaintextHint)).toBe(true);

    await clearSessionCredentialSecrets(sessionId);

    const after = await db.query.sessionRegionCredentials.findMany({ where: eq(sessionRegionCredentials.sessionId, sessionId) });
    expect(after).toHaveLength(REGIONS.length);
    expect(after.every((c) => c.plaintextHint === null)).toBe(true);
    // Hashes are untouched — a reopened session's region logins still work
    // (see lib/auth-verify.ts verifyCredentials, which only ever compares
    // against passwordHash).
    for (const c of after) {
      const original = before.find((b) => b.id === c.id)!;
      expect(c.passwordHash).toBe(original.passwordHash);
    }
  });

  it("only clears the targeted session's credentials, not another session's", async () => {
    const a = await createTestSession("instructor");
    const b = await createTestSession("instructor");

    await clearSessionCredentialSecrets(a.sessionId);

    const credsB = await db.query.sessionRegionCredentials.findMany({ where: eq(sessionRegionCredentials.sessionId, b.sessionId) });
    expect(credsB.every((c) => c.plaintextHint)).toBe(true);
  });
});
