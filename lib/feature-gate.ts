// Server-side enforcement of the phased feature unlock (lib/feature-unlock.ts)
// so a locked feature can't be used by calling its API directly. Only team
// actions are gated; the facilitator (e.g. WHO HQ contributing to a funding
// request) and cancelling an existing request are never blocked.
import { NextResponse } from "next/server";
import { db } from "./db";
import { eventDispatches, gameSessions, sessionState } from "./db/schema";
import { eq } from "drizzle-orm";
import { computeFeatureUnlocks, type FeatureUnlockState, type GatedFeature } from "./feature-unlock";

export async function featureUnlocksFor(sessionId: string): Promise<Record<GatedFeature, FeatureUnlockState>> {
  const session = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, sessionId) });
  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  const dispatches = await db.query.eventDispatches.findMany({ where: eq(eventDispatches.sessionId, sessionId) });
  return computeFeatureUnlocks({
    mode: session?.mode ?? "instructor",
    featuresUnlockedEarly: !!gs?.featuresUnlockedEarly,
    firedEventCount: new Set(dispatches.map((d) => d.eventId)).size,
  });
}

// Returns a 403 response when the feature is still locked for this team.
export async function lockedResponse(sessionId: string, feature: GatedFeature, role: "instructor" | "student"): Promise<NextResponse | null> {
  if (role === "instructor") return null;
  const s = (await featureUnlocksFor(sessionId))[feature];
  return s.open ? null : NextResponse.json({ error: s.message, locked: true }, { status: 403 });
}
