// Single atomic increment on sessionState.stateVersion — /api/dashboard and
// /api/display's ?since=<version> poll-backoff (Phase 5) compares against
// this to decide whether to do any work at all.
//
// Wired into the highest-traffic mutation chokepoints (lib/model-engine's
// applyFieldDelta/recomputeEscalationState, lib/db-atomic.ts's four
// balance-mutation helpers, lib/decisions.ts's cost functions and decision
// inserts) rather than exhaustively into every single mutating route.
// That's a deliberate scope boundary, not an oversight: missing a bump on
// some rarer mutation path only costs a missed optimization (the client's
// next poll falls back to fetching fresh state anyway, per its normal
// interval) — it's not a correctness bug the way missing a sessionId scope
// check would be.
import { db } from "./db";
import { sessionState } from "./db/schema";
import { eq, sql } from "drizzle-orm";

export async function bumpStateVersion(sessionId: string): Promise<void> {
  await db
    .update(sessionState)
    .set({ stateVersion: sql`${sessionState.stateVersion} + 1` })
    .where(eq(sessionState.sessionId, sessionId));
}
