import { NextRequest, NextResponse } from "next/server";
import { processDeadlines } from "@/lib/deadline";
import { db } from "@/lib/db";
import { gameSessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Vercel Cron target — runs once daily on the Hobby plan (see vercel.json);
// this is the coarse fallback tick, not the primary one (see the note in
// lib/deadline.ts — most ticks happen opportunistically from dashboard/
// display polls). Also callable manually for local testing. Auth: matches
// Vercel's CRON_SECRET convention when set; open in local dev where
// CRON_SECRET is unset.
//
// Loops over every running session rather than a single global tick, since
// each session ticks independently now (see lib/deadline.ts). Sequential,
// not parallel — this is a once-a-day fallback, not a latency-sensitive
// path, and sequential keeps it simple to reason about under Neon's
// connection limits.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const runningSessions = await db.query.gameSessions.findMany({ where: eq(gameSessions.status, "running") });
  const results = [];
  for (const s of runningSessions) {
    results.push({ sessionId: s.id, ...(await processDeadlines(s.id)) });
  }
  return NextResponse.json({ sessions: results.length, results });
}
