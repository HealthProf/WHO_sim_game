// After a decision is scored (whether by the instructor or auto-applied at
// deadline expiry), two things should happen beyond the model_state update
// itself: (1) the submitting team gets a private, specific "here's what just
// happened because of your choice" card, and (2) genuinely big swings get
// surfaced automatically — on the shared projector display and as a callout
// on affected teams' dashboards — instead of relying on the instructor to
// remember to click "Push to Global Display" every time.
//
// The card text is built entirely from each event's existing consequencesJson
// prose (already authored per-tier in lib/db/seed-data/events.ts) — no new
// content authoring required, it's just addressed to the specific region and
// delivered as a notification instead of sitting inert in the database.

import { db } from "./db";
import { eventDispatches, globalFeedItems, instructorActions, teamNotifications } from "./db/schema";
import { eq } from "drizzle-orm";
import { isSignificantDelta } from "./model-engine";
import { pickVignette } from "./vignettes";
import type { ModelDelta, Tier } from "./db/seed-data/events";

const TIER_KEY: Record<Tier, "optimal" | "adequate" | "inadequate" | "critical"> = {
  OPTIMAL: "optimal",
  ADEQUATE: "adequate",
  INADEQUATE: "inadequate",
  CRITICAL_FAILURE: "critical",
};

interface AfterState {
  cfrMultiplier: number;
  hcwSurgePct: number;
  publicTrustIndex: number;
  populationHappinessIndex: number;
  hospitalCapacityPct: number;
}

export function buildConsequenceCard(
  event: { title: string; consequencesJson: unknown },
  regionId: string,
  tier: Tier,
  afterState?: AfterState
): string {
  const consequences = event.consequencesJson as Record<"optimal" | "adequate" | "inadequate" | "critical", string>;
  const prose = consequences[TIER_KEY[tier]];
  const base = `${regionId} — ${event.title} (${tier.replace("_", " ")}): ${prose}`;
  const vignette = afterState ? pickVignette(afterState, regionId) : null;
  return vignette ? `${base} ${vignette}` : base;
}

// Called right after applyModelDelta() for a freshly-scored decision (from
// either the instructor scoring inbox or the deadline-expiry auto-fallback).
// Always writes the private team card; additionally auto-pushes to the
// public display when the event was mandatory-review, resulted in a Critical
// Failure, or produced a large enough model swing to matter.
export async function pushConsequence(opts: {
  event: {
    id: string;
    title: string;
    consequencesJson: unknown;
    requiresMandatoryReview: boolean;
  };
  dispatchId: number;
  teamId: number;
  regionId: string;
  tier: Tier;
  deltas: ModelDelta[];
  actorUserId: number;
  afterState?: AfterState;
}) {
  const { event, dispatchId, teamId, regionId, tier, deltas, actorUserId, afterState } = opts;

  const cardText = buildConsequenceCard(event, regionId, tier, afterState);
  await db.insert(teamNotifications).values({
    teamId,
    eventDispatchId: dispatchId,
    kind: "consequence",
    message: cardText,
  });

  const isMajor = event.requiresMandatoryReview || tier === "CRITICAL_FAILURE" || isSignificantDelta(deltas);
  if (!isMajor) return;

  await db.update(eventDispatches).set({ revealedToPublic: true }).where(eq(eventDispatches.id, dispatchId));
  await db.insert(globalFeedItems).values({
    headlineText: cardText,
    eventDispatchId: dispatchId,
  });
  await db.insert(instructorActions).values({
    instructorUserId: actorUserId,
    actionType: "auto_push_to_global_display",
    targetDesc: `${event.id} (${regionId}, ${tier}) auto-pushed — ${
      event.requiresMandatoryReview ? "mandatory-review event" : tier === "CRITICAL_FAILURE" ? "critical failure" : "large model swing"
    }`,
  });
}
