import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionState, instructorActions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireInstructorActor } from "@/lib/session-context";
import { bumpStateVersion } from "@/lib/state-version";

// PATCH: Release 2 facilitator switches. Only the listed boolean keys are
// accepted; anything else in the body is ignored.
const KEYS = ["autoAcceptScores", "resultsRevealForced", "showExpectedEffects", "featuresUnlockedEarly"] as const;
type Key = (typeof KEYS)[number];

const LABEL: Record<Key, string> = {
  autoAcceptScores: "Auto-accept provisional scores",
  resultsRevealForced: "Always show decision results to teams",
  showExpectedEffects: "Show expected effects on event pages",
  featuresUnlockedEarly: "Open pledges, funding, and marketplace now",
};

export async function PATCH(req: NextRequest) {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json().catch(() => ({}));
  const update: Partial<Record<Key, boolean>> = {};
  for (const k of KEYS) if (typeof body[k] === "boolean") update[k] = body[k];
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "No recognized setting in request" }, { status: 400 });

  await db.update(sessionState).set({ ...update, updatedAt: new Date() }).where(eq(sessionState.sessionId, sessionId));
  await bumpStateVersion(sessionId);
  await db.insert(instructorActions).values({
    sessionId,
    instructorUserId: actor!.userId!,
    actionType: "set_setting",
    targetDesc: Object.entries(update)
      .map(([k, v]) => `${LABEL[k as Key]}: ${v ? "on" : "off"}`)
      .join("; "),
  });
  return NextResponse.json({ ok: true, ...update });
}
