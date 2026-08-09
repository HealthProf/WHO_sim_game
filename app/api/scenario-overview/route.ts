import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionState, gameSessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireActor } from "@/lib/session-context";
import { SCENARIO_OVERVIEW_TOTAL_SECONDS } from "@/lib/db/seed-data/scenario-overview-slides";

// Update 3's synchronization endpoint — deliberately its own tiny route
// rather than folded into /api/dashboard or /api/display. Those poll at
// 15s/4s-backing-off-to-30s and both opportunistically run processDeadlines,
// which is far too coarse and heavy for a 70-second, 10-seconds-per-slide
// sequence: this is polled every 5s by every connected client (see
// components/scenario-overview-watcher.tsx) and does a single indexed read,
// nothing else.
//
// Two auth paths, mirroring app/api/display/route.ts: `?token=` resolves the
// session from gameSessions.displayToken for the unauthenticated projector
// (never the session's primary key); otherwise the normal authenticated
// actor. Neither path ever accepts a sessionId directly from the client.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  // landingPath is where the client should navigate once the deck finishes
  // — deliberately computed here from the resolved Actor rather than left
  // for the client to re-derive from next-auth's session object. That
  // object's role field only reflects *session ownership*, not which region
  // a demo owner is currently occupying (see lib/session-context.ts's
  // resolveActor — Actor.role correctly resolves "student" for a demo owner
  // occupying a region, which the JWT-level role never does). The
  // unauthenticated token path never gets a landingPath: the projector must
  // never navigate away from the display route.
  let sessionId: string;
  let landingPath: string | null = null;
  if (token) {
    const session = await db.query.gameSessions.findFirst({ where: eq(gameSessions.displayToken, token) });
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    sessionId = session.id;
  } else {
    const { actor, error } = await requireActor();
    if (error) return error;
    sessionId = actor!.sessionId;
    landingPath = actor!.role === "instructor" ? "/control" : "/briefing";
  }

  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });

  // Bounded to the deck's own runtime, same fix as the barrel-roll cheat
  // code's replay bug (lib/cheat-engine.ts getCheatDisplayState): without an
  // expiry, a client loading long after the sequence finished would read
  // the same non-null timestamp and derive slide 7 forever, or worse, an
  // out-of-range index if the math weren't clamped elsewhere too.
  const startedAt =
    gs?.scenarioOverviewStartedAt && Date.now() - new Date(gs.scenarioOverviewStartedAt).getTime() <= SCENARIO_OVERVIEW_TOTAL_SECONDS * 1000
      ? new Date(gs.scenarioOverviewStartedAt).toISOString()
      : null;

  return NextResponse.json({ startedAt, landingPath });
}
