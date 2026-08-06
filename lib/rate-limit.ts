// Per-IP request throttling, DB-backed rather than in-memory — on Vercel
// each lambda instance gets its own memory, so an in-memory limiter would be
// close to decorative. Fixed window: a key's count resets once
// RATE_LIMIT_WINDOW_SECONDS have elapsed since the window started, rather
// than tracking a sliding log of timestamps. One extra atomic write per
// checked attempt is the accepted tradeoff for this being real under
// concurrent requests.
import { db } from "./db";
import { rateLimitCounters } from "./db/schema";
import { sql } from "drizzle-orm";
import { RATE_LIMIT_WINDOW_SECONDS, RATE_LIMIT_MAX_ATTEMPTS } from "./config";

// Returns true if this attempt is allowed (and counts it), false if the
// caller has exceeded RATE_LIMIT_MAX_ATTEMPTS within the current window.
//
// A single insert-or-update statement rather than the previous
// read-then-write sequence (up to 3 round trips): each one on the Neon HTTP
// driver pays a full request/response cycle, and stacked sequentially in a
// route that also does its own DB work, that was enough to blow past
// Vercel's function timeout on a cold/suspended Neon compute. The CASE
// expressions fold "bump the current window" and "reset a stale window"
// into one atomic conditional UPDATE (same single-statement pattern as
// lib/db-atomic.ts), so concurrent requests from the same key still can't
// both read a stale count and both succeed past the limit.
export async function checkRateLimit(key: string): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_SECONDS * 1000);

  const [row] = await db
    .insert(rateLimitCounters)
    .values({ key, windowStartedAt: now, count: 1 })
    .onConflictDoUpdate({
      target: rateLimitCounters.key,
      set: {
        windowStartedAt: sql`CASE WHEN ${rateLimitCounters.windowStartedAt} < ${windowStart} THEN ${now} ELSE ${rateLimitCounters.windowStartedAt} END`,
        count: sql`CASE WHEN ${rateLimitCounters.windowStartedAt} < ${windowStart} THEN 1 ELSE ${rateLimitCounters.count} + 1 END`,
      },
    })
    .returning();

  return row.count <= RATE_LIMIT_MAX_ATTEMPTS;
}

export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
