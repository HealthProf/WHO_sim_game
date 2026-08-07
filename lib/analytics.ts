// Instructor-only engagement analytics — a curated set of gameplay actions,
// logged so the maintainer can later export analytics_events (Vercel's
// Storage tab -> the Neon project's SQL editor) and hand it to Claude for
// engagement analysis. Never rendered anywhere in the product, and never
// written for demo sessions at all — callers pass `mode` and this module
// skips the insert outright rather than filtering demo rows out later, so a
// raw export can never accidentally include them.
import { db } from "./db";
import { analyticsEvents } from "./db/schema";

// The fixed set of events this app tracks. Keep this list in sync with the
// call sites below — it exists mainly so a typo in an event name is a
// compile error, not a silent gap in the data.
export type AnalyticsEventType =
  | "session_created"
  | "decision_submitted"
  | "trade_proposed"
  | "trade_resolved"
  | "pledge_made"
  | "emergency_funding_requested"
  | "emergency_funding_contributed"
  | "marketplace_purchase"
  | "coordination_message_sent"
  | "snap_vote_responded"
  | "score_submitted";

interface LogAnalyticsEventInput {
  sessionId: string;
  mode: "instructor" | "demo";
  eventType: AnalyticsEventType;
  actorRole?: "instructor" | "student" | null;
  regionId?: string | null;
  userId?: number | null;
  metadata?: Record<string, unknown>;
}

export async function logAnalyticsEvent({
  sessionId,
  mode,
  eventType,
  actorRole,
  regionId,
  userId,
  metadata,
}: LogAnalyticsEventInput): Promise<void> {
  if (mode === "demo") return;
  try {
    await db.insert(analyticsEvents).values({
      sessionId,
      eventType,
      actorRole: actorRole ?? null,
      regionId: regionId ?? null,
      userId: userId ?? null,
      metadataJson: metadata ?? null,
    });
  } catch (err) {
    // Never let analytics logging break the request it's instrumenting.
    console.error(`logAnalyticsEvent(${eventType}) failed:`, err);
  }
}
