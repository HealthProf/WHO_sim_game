import { NextRequest, NextResponse } from "next/server";
import { processDeadlines } from "@/lib/deadline";

// Vercel Cron target — runs every minute (see vercel.json). Also callable
// manually for local testing. Auth: matches Vercel's CRON_SECRET convention
// when set; open in local dev where CRON_SECRET is unset.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const result = await processDeadlines();
  return NextResponse.json(result);
}
