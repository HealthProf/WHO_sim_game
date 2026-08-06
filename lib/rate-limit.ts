// Per-IP request throttling, DB-backed rather than in-memory — on Vercel
// each lambda instance gets its own memory, so an in-memory limiter would be
// close to decorative. Fixed window: a key's count resets once
// RATE_LIMIT_WINDOW_SECONDS have elapsed since the window started, rather
// than tracking a sliding log of timestamps. One extra atomic write per
// checked attempt is the accepted tradeoff for this being real under
// concurrent requests.
import { db } from "./db";
import { rateLimitCounters } from "./db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { RATE_LIMIT_WINDOW_SECONDS, RATE_LIMIT_MAX_ATTEMPTS } from "./config";

// Returns true if this attempt is allowed (and counts it), false if the
// caller has exceeded RATE_LIMIT_MAX_ATTEMPTS within the current window.
export async function checkRateLimit(key: string): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_SECONDS * 1000);

  // Try to bump an existing, still-current window first — a single atomic
  // conditional UPDATE (same pattern as lib/db-atomic.ts) so concurrent
  // requests from the same key can't both read a stale count and both
  // succeed past the limit.
  const bumped = await db
    .update(rateLimitCounters)
    .set({ count: sql`${rateLimitCounters.count} + 1` })
    .where(and(eq(rateLimitCounters.key, key), gte(rateLimitCounters.windowStartedAt, windowStart), sql`${rateLimitCounters.count} < ${RATE_LIMIT_MAX_ATTEMPTS}`))
    .returning();
  if (bumped.length > 0) return true;

  // No current-window row was bumped — either none exists, the existing one
  // is stale (needs resetting), or it's already at the cap. Distinguish
  // "stale, needs reset" from "at the cap" with a fresh read.
  const existing = await db.query.rateLimitCounters.findFirst({ where: eq(rateLimitCounters.key, key) });
  if (existing && existing.windowStartedAt >= windowStart) {
    return false; // current window, already at cap
  }

  // Either no row yet, or the existing row's window has expired — reset it.
  // onConflictDoUpdate here is itself the atomic guard against two
  // concurrent first-requests both inserting.
  await db
    .insert(rateLimitCounters)
    .values({ key, windowStartedAt: now, count: 1 })
    .onConflictDoUpdate({ target: rateLimitCounters.key, set: { windowStartedAt: now, count: 1 } });
  return true;
}

export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
