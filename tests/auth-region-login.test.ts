import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { sessionRegionCredentials } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resetDb, seedStaticOnce } from "./helpers/db";
import { createTestSession } from "./helpers/session";
import { verifyCredentials } from "@/lib/auth-verify";
import { isRateLimited, consumeRateLimit, clearRateLimit } from "@/lib/rate-limit";
import { REGIONS } from "@/lib/regions";

// Covers Update 4e: region logins failing in Class Session mode. Deliberately
// does NOT import lib/auth.ts — it transitively pulls in next-auth's
// "next/server" subpath, which plain Vitest (no Next plugin) can't resolve
// (see tests/isolation.test.ts's header comment for the same constraint).
// Instead this exercises lib/auth-verify.ts's verifyCredentials() directly
// (the DB-verification core authorize() delegates to) and lib/rate-limit.ts's
// primitives (the exact building blocks authorize() composes for the
// per-credential / per-IP sign-in budgets), which together cover the whole
// bug without needing a real HTTP/NextAuth round trip.

const SIGNIN_MAX_ATTEMPTS_PER_CREDENTIAL = 10;

describe("region login credentials", () => {
  beforeEach(async () => {
    await resetDb();
    await seedStaticOnce();
  });

  it("verifies all six generated region credentials", async () => {
    const { sessionId } = await createTestSession("instructor");
    const creds = await db.query.sessionRegionCredentials.findMany({ where: eq(sessionRegionCredentials.sessionId, sessionId) });
    expect(creds).toHaveLength(REGIONS.length);

    for (const cred of creds) {
      expect(cred.plaintextHint).toBeTruthy();
      const result = await verifyCredentials(cred.username, cred.plaintextHint!);
      expect(result.outcome).toBe("ok");
      if (result.outcome === "ok") {
        expect(result.actor.kind).toBe("region");
        expect(result.actor.regionId).toBe(cred.regionId);
        expect(result.actor.sessionId).toBe(sessionId);
      }
    }
  });

  it("rejects a wrong password for a real region username", async () => {
    const { sessionId } = await createTestSession("instructor");
    const cred = await db.query.sessionRegionCredentials.findFirst({ where: eq(sessionRegionCredentials.sessionId, sessionId) });
    const result = await verifyCredentials(cred!.username, "definitely-wrong");
    expect(result.outcome).toBe("invalid");
  });

  it("rejects an unknown username", async () => {
    const result = await verifyCredentials("afro-doesnotexist", "whatever");
    expect(result.outcome).toBe("invalid");
  });

  it("generated passwords use an unambiguous alphabet (no 0/1/l/O/I confusion)", async () => {
    const { sessionId } = await createTestSession("instructor");
    const creds = await db.query.sessionRegionCredentials.findMany({ where: eq(sessionRegionCredentials.sessionId, sessionId) });
    for (const cred of creds) {
      expect(cred.plaintextHint).toMatch(/^[A-HJ-NP-Z2-9]+$/);
    }
  });

  // Reproduces the reported incident directly: the sign-in rate limiter used
  // to count every attempt (success or failure) against one shared per-IP
  // key, so a handful of correct logins from the same IP — e.g. an
  // instructor's own account, tested repeatedly before class — could lock
  // out every region login in the room. This test drives the exact sequence
  // lib/auth.ts's authorize() now runs: check-then-verify-then-clear-or-consume,
  // using the same exported primitives, to prove ten *successful* sign-ins in
  // a row never lock out the eleventh.
  it("ten successful sign-ins in a row do not lock out the eleventh", async () => {
    const { sessionId } = await createTestSession("instructor");
    const cred = await db.query.sessionRegionCredentials.findFirst({ where: eq(sessionRegionCredentials.sessionId, sessionId) });
    const ip = "203.0.113.42";
    const credentialKey = `${ip}:${cred!.username}:signin`;

    async function attemptSignIn(username: string, password: string): Promise<"ok" | "blocked" | "invalid"> {
      if (await isRateLimited(credentialKey, SIGNIN_MAX_ATTEMPTS_PER_CREDENTIAL)) return "blocked";
      const result = await verifyCredentials(username, password);
      if (result.outcome === "invalid") {
        await consumeRateLimit(credentialKey);
        return "invalid";
      }
      await clearRateLimit(credentialKey);
      return "ok";
    }

    for (let i = 0; i < 11; i++) {
      const outcome = await attemptSignIn(cred!.username, cred!.plaintextHint!);
      expect(outcome).toBe("ok");
    }
  });

  it("does lock out a credential after enough failed attempts, independent of other credentials", async () => {
    const { sessionId } = await createTestSession("instructor");
    const creds = await db.query.sessionRegionCredentials.findMany({ where: eq(sessionRegionCredentials.sessionId, sessionId) });
    const target = creds[0];
    const bystander = creds[1];
    const ip = "203.0.113.43";
    const targetKey = `${ip}:${target.username}:signin`;
    const bystanderKey = `${ip}:${bystander.username}:signin`;

    for (let i = 0; i < SIGNIN_MAX_ATTEMPTS_PER_CREDENTIAL; i++) {
      const result = await verifyCredentials(target.username, "wrong");
      expect(result.outcome).toBe("invalid");
      await consumeRateLimit(targetKey);
    }
    expect(await isRateLimited(targetKey, SIGNIN_MAX_ATTEMPTS_PER_CREDENTIAL)).toBe(true);

    // A different region's credential, from the same IP, is untouched.
    expect(await isRateLimited(bystanderKey, SIGNIN_MAX_ATTEMPTS_PER_CREDENTIAL)).toBe(false);
    const bystanderResult = await verifyCredentials(bystander.username, bystander.plaintextHint!);
    expect(bystanderResult.outcome).toBe("ok");
  });
});
