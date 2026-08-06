import { describe, expect, it, beforeEach } from "vitest";
import { glob } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { teams, modelState } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { resetDb, seedStaticOnce } from "./helpers/db";
import { createTestSession } from "./helpers/session";
import { tryDeductRegionField } from "@/lib/db-atomic";

describe("concurrent balance mutations", () => {
  beforeEach(async () => {
    await resetDb();
    await seedStaticOnce();
  });

  it("exactly one of N concurrent deductions succeeds when only one can be afforded", async () => {
    const { sessionId } = await createTestSession("instructor");
    const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.regionId, "AFRO")) });
    const before = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, "AFRO")) });
    const fund = before!.fundRemaining;

    // Ten concurrent attempts to each deduct 70% of the current balance —
    // at most one can succeed without the balance going negative.
    const amount = Math.round(fund * 0.7);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => tryDeductRegionField(sessionId, team!.regionId, "fundRemaining", amount))
    );

    const successes = results.filter(Boolean).length;
    expect(successes).toBe(1);

    const after = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, "AFRO")) });
    expect(after!.fundRemaining).toBe(fund - amount);
    expect(after!.fundRemaining).toBeGreaterThanOrEqual(0);
  });

  it("the same atomic guard is independently session-scoped under concurrent load", async () => {
    const a = await createTestSession("instructor");
    const b = await createTestSession("instructor");
    const teamA = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, a.sessionId), eq(teams.regionId, "AFRO")) });
    const teamB = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, b.sessionId), eq(teams.regionId, "AFRO")) });
    const beforeA = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, a.sessionId), eq(modelState.regionId, "AFRO")) });
    const beforeB = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, b.sessionId), eq(modelState.regionId, "AFRO")) });

    const amountA = Math.round(beforeA!.fundRemaining * 0.7);
    const amountB = Math.round(beforeB!.fundRemaining * 0.7);

    // Fire both sessions' "only one should win" races in parallel, at the
    // same time — proves session A's races don't starve/interact with
    // session B's.
    const [resultsA, resultsB] = await Promise.all([
      Promise.all(Array.from({ length: 6 }, () => tryDeductRegionField(a.sessionId, teamA!.regionId, "fundRemaining", amountA))),
      Promise.all(Array.from({ length: 6 }, () => tryDeductRegionField(b.sessionId, teamB!.regionId, "fundRemaining", amountB))),
    ]);

    expect(resultsA.filter(Boolean).length).toBe(1);
    expect(resultsB.filter(Boolean).length).toBe(1);

    const afterA = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, a.sessionId), eq(modelState.regionId, "AFRO")) });
    const afterB = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, b.sessionId), eq(modelState.regionId, "AFRO")) });
    expect(afterA!.fundRemaining).toBe(beforeA!.fundRemaining - amountA);
    expect(afterB!.fundRemaining).toBe(beforeB!.fundRemaining - amountB);
  });
});

describe("no db.transaction() anywhere in the project", () => {
  it("grep-based regression guard — db.transaction() throws at runtime on the neon-http driver", async () => {
    const root = path.resolve(__dirname, "..");
    const offenders: string[] = [];
    for await (const file of glob("{app,lib,scripts,components}/**/*.{ts,tsx}", { cwd: root })) {
      const full = path.join(root, file);
      const content = await readFile(full, "utf8");
      // Skip lines that are themselves comments (the codebase explains the
      // no-db.transaction() rule inline, e.g. lib/db-atomic.ts's header) —
      // this guard is only about real usage, an actual `db.transaction(` call.
      const hasRealCall = content
        .split("\n")
        .some((line) => line.includes("db.transaction(") && !line.trim().startsWith("//") && !line.trim().startsWith("*"));
      if (hasRealCall) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
