import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  modelState,
  modelStateOptimal,
  modelStateHistory,
  sessionState,
  eventDispatches,
  decisions,
  scores,
  coordinationMessages,
  instructorActions,
  globalFeedItems,
  teamNotifications,
  resourcePledges,
  snapVoteResponses,
  snapVotes,
  announcementAcks,
  announcements,
  budgetCycleDonations,
  budgetCycleResponses,
  budgetCycles,
  marketRequests,
  regionTradeOffers,
  emergencyFundingContributions,
  emergencyFundingRequests,
  socialMilestoneAwards,
  cheatCodeAttempts,
  cheatCodeRedemptions,
  cheatRegionEffects,
  cheatCodeState,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { requireInstructorActor } from "@/lib/session-context";
import { SCENARIO_OVERVIEW_PREROLL_SECONDS } from "@/lib/config";

// Resets *this session* to a fresh start: wipes every in-progress-game row
// scoped to it (dispatches, decisions, scores, model history, coordination
// log, feed items, action log, team notifications, pledges, snap votes) and
// restores its model_state/session_state to their original seeded values,
// derived from the regions table's starting* columns so this never gets out
// of sync with lib/db/seed-data/regions.ts. Leaves regions, events,
// event_chain_links, teams, and session_region_credentials untouched — login
// accounts and static content are never affected by a reset.
export async function POST() {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  // Order matters: children before the parents they reference.
  await db.delete(scores).where(eq(scores.sessionId, sessionId)); // -> decisions
  await db.delete(decisions).where(eq(decisions.sessionId, sessionId)); // -> eventDispatches
  await db.delete(coordinationMessages).where(eq(coordinationMessages.sessionId, sessionId)); // -> eventDispatches (nullable)
  await db.delete(globalFeedItems).where(eq(globalFeedItems.sessionId, sessionId)); // -> eventDispatches (nullable)
  await db.delete(teamNotifications).where(eq(teamNotifications.sessionId, sessionId)); // -> eventDispatches (nullable)
  await db.delete(resourcePledges).where(eq(resourcePledges.sessionId, sessionId)); // -> eventDispatches (nullable)
  await db.delete(snapVoteResponses).where(eq(snapVoteResponses.sessionId, sessionId)); // -> snapVotes
  await db.delete(snapVotes).where(eq(snapVotes.sessionId, sessionId));
  await db.delete(announcementAcks).where(eq(announcementAcks.sessionId, sessionId)); // -> announcements
  await db.delete(announcements).where(eq(announcements.sessionId, sessionId)); // -> eventDispatches (nullable)
  await db.delete(budgetCycleDonations).where(eq(budgetCycleDonations.sessionId, sessionId)); // -> budgetCycles
  await db.delete(budgetCycleResponses).where(eq(budgetCycleResponses.sessionId, sessionId)); // -> budgetCycles
  await db.delete(budgetCycles).where(eq(budgetCycles.sessionId, sessionId));
  await db.delete(marketRequests).where(eq(marketRequests.sessionId, sessionId));
  await db.delete(regionTradeOffers).where(eq(regionTradeOffers.sessionId, sessionId));
  await db.delete(emergencyFundingContributions).where(eq(emergencyFundingContributions.sessionId, sessionId)); // -> emergencyFundingRequests
  await db.delete(emergencyFundingRequests).where(eq(emergencyFundingRequests.sessionId, sessionId));
  await db.delete(socialMilestoneAwards).where(eq(socialMilestoneAwards.sessionId, sessionId));
  await db.delete(eventDispatches).where(eq(eventDispatches.sessionId, sessionId));
  await db.delete(modelStateHistory).where(eq(modelStateHistory.sessionId, sessionId));
  await db.delete(instructorActions).where(eq(instructorActions.sessionId, sessionId));
  // Cheat-code state: without this, God Mode's flag and an in-progress
  // "revert to zero" taper would silently survive a reset even though every
  // other piece of game state was wiped (Update 1a's audit). None of these
  // four tables are referenced by any other table, so deletion order among
  // them doesn't matter.
  await db.delete(cheatCodeAttempts).where(eq(cheatCodeAttempts.sessionId, sessionId));
  await db.delete(cheatCodeRedemptions).where(eq(cheatCodeRedemptions.sessionId, sessionId));
  await db.delete(cheatRegionEffects).where(eq(cheatRegionEffects.sessionId, sessionId));
  await db.delete(cheatCodeState).where(eq(cheatCodeState.sessionId, sessionId));

  const allRegions = await db.query.regions.findMany();
  for (const r of allRegions) {
    await db
      .update(modelState)
      .set({
        day: 1,
        rt: r.startingRt,
        cfrMultiplier: r.startingCfrMultiplier,
        confirmedCases: r.startingConfirmed,
        estimatedTrueCasesLow: r.startingEstTrueLow,
        estimatedTrueCasesHigh: r.startingEstTrueHigh,
        deaths: r.startingDeaths,
        hospitalCapacityPct: r.startingHospCapacityPct,
        surveillanceIndex: r.startingSurveillanceIndex,
        fundRemaining: r.startingFund,
        ppeDaysRemaining: r.startingPpeDays,
        antiviralsRemaining: r.startingAntivirals,
        hcwSurgePct: r.startingHcwSurgePct,
        politicalTensionIndex: r.startingPoliticalTension,
        publicTrustIndex: r.startingPublicTrust,
        populationHappinessIndex: 60,
        updatedAt: new Date(),
      })
      .where(and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, r.id)));

    await db
      .update(modelStateOptimal)
      .set({
        rt: r.startingRt,
        cfrMultiplier: r.startingCfrMultiplier,
        confirmedCases: r.startingConfirmed,
        estimatedTrueCasesLow: r.startingEstTrueLow,
        estimatedTrueCasesHigh: r.startingEstTrueHigh,
        deaths: r.startingDeaths,
        publicTrustIndex: r.startingPublicTrust,
        populationHappinessIndex: 60,
        updatedAt: new Date(),
      })
      .where(and(eq(modelStateOptimal.sessionId, sessionId), eq(modelStateOptimal.regionId, r.id)));
  }

  await db
    .update(sessionState)
    .set({
      currentDay: 1,
      escalationState: "GREEN",
      mediaPressureIndex: 0,
      simulationStatus: "not_started",
      simulationStartedAt: null,
      pausedAccumulatedMs: 0,
      pausedAt: null,
      lastDriftAppliedAt: null,
      lastTickAt: null,
      whoHqFund: 500_000_000,
      whoHqPpeStock: 2000,
      whoHqAntiviralsStock: 200_000,
      lastBudgetCycleNarrativeDay: 0,
      intensityMultiplier: 1.0,
      // Update 3: a reset re-plays the Scenario Overview deck for everyone,
      // identically to a brand-new session — "a reset does not skip or
      // shortcut any part of this flow" is explicit in the spec. Both modes
      // get this (unlike session creation, where only demo mode starts the
      // deck immediately — Class Session mode's equivalent trigger is the
      // instructor's button, which isn't available at the exact moment of
      // a reset the way it is at creation-then-credential-sheet time). Set
      // a few seconds in the future, not "now" — see
      // SCENARIO_OVERVIEW_PREROLL_SECONDS's comment in lib/config.ts.
      scenarioOverviewStartedAt: new Date(Date.now() + SCENARIO_OVERVIEW_PREROLL_SECONDS * 1000),
      updatedAt: new Date(),
    })
    .where(eq(sessionState.sessionId, sessionId));

  // Logged after the wipe so it's the first entry in the fresh action log.
  await db.insert(instructorActions).values({
    sessionId,
    instructorUserId: Number(actor!.userId),
    actionType: "simulation_reset",
    targetDesc: "all decisions, scores, dispatches, and model state reset to seeded starting values",
  });

  return NextResponse.json({ ok: true });
}
