// Atomic single-statement balance mutations for the economy routes (market,
// trade, emergency funding, budget cycle).
//
// Why not db.transaction()? This app's production driver is Neon's HTTP
// client (see lib/db/index.ts) for the well-documented reason that a
// long-lived pg.Pool from serverless functions exhausts connections — and
// the neon-http drizzle driver explicitly does not support
// db.transaction() (it throws "No transactions support in neon-http
// driver" at runtime). That call would type-check and pass fine against
// local Postgres (which does support it) and then break in actual
// production, which is a worse outcome than not having transactions at
// all. Neon's batch-transaction endpoint isn't exposed at the top-level db
// object either, so it isn't a drop-in option.
//
// Instead, every balance change here is a single atomic UPDATE ... WHERE
// balance >= amount statement. Postgres guarantees row-level atomicity for
// a single UPDATE regardless of driver, so this closes the actual
// exploitable race (two concurrent requests both reading a stale balance
// and both succeeding) without needing a cross-statement transaction. What
// it does NOT give you is atomicity ACROSS two different rows in the same
// operation (e.g. a trade's buyer-debit and seller-credit) — a crash
// between those two statements could still leave a half-applied transfer.
// That residual risk is accepted: every multi-row mutation here debits
// first and credits second, so a crash mid-sequence destroys value rather
// than duplicating it, which is the far less exploitable failure mode in a
// competitive game.

import { db } from "./db";
import { modelState, globalState } from "./db/schema";
import { and, eq, sql } from "drizzle-orm";

type FundField = "fundRemaining" | "ppeDaysRemaining" | "antiviralsRemaining";

// Attempts to deduct `amount` from a region's fund/PPE/antivirals field.
// Returns false (no row changed) if the region no longer has enough —
// callers should treat that exactly like the old pre-check failing. The
// balance comparison is done in the same `sql` fragment as the column
// reference (rather than via the typed gte() helper) since `field` is a
// union of possible columns and gte()'s generic overload resolution
// doesn't narrow cleanly against a union column type.
export async function tryDeductRegionField(regionId: string, field: FundField, amount: number): Promise<boolean> {
  const result = await db
    .update(modelState)
    .set({ [field]: sql`${modelState[field]} - ${amount}`, updatedAt: new Date() } as never)
    .where(and(eq(modelState.regionId, regionId), sql`${modelState[field]} >= ${amount}`))
    .returning();
  return result.length > 0;
}

// Credits are never blocked by a balance floor, but still done as a single
// atomic increment (SET x = x + amount) rather than read-then-write, so a
// concurrent credit to the same region can never be lost to a stale read.
export async function creditRegionField(regionId: string, field: FundField, amount: number): Promise<void> {
  await db
    .update(modelState)
    .set({ [field]: sql`${modelState[field]} + ${amount}`, updatedAt: new Date() } as never)
    .where(eq(modelState.regionId, regionId));
}

type WhoHqStockField = "whoHqPpeStock" | "whoHqAntiviralsStock" | "whoHqFund";

export async function tryDeductWhoHqField(field: WhoHqStockField, amount: number): Promise<boolean> {
  const result = await db
    .update(globalState)
    .set({ [field]: sql`${globalState[field]} - ${amount}`, updatedAt: new Date() } as never)
    .where(and(eq(globalState.id, 1), sql`${globalState[field]} >= ${amount}`))
    .returning();
  return result.length > 0;
}

export async function creditWhoHqField(field: WhoHqStockField, amount: number): Promise<void> {
  await db
    .update(globalState)
    .set({ [field]: sql`${globalState[field]} + ${amount}`, updatedAt: new Date() } as never)
    .where(eq(globalState.id, 1));
}
