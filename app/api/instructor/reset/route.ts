import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  regions,
  modelState,
  modelStateOptimal,
  modelStateHistory,
  globalState,
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
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireInstructor } from "@/lib/api-helpers";

// Resets the game to a fresh start: wipes every in-progress-game table
// (dispatches, decisions, scores, model history, coordination log, feed
// items, action log, team notifications, pledges, snap votes) and restores
// model_state/global_state to their original seeded values, derived from
// the regions table's starting* columns so this never gets out of sync with
// lib/db/seed-data/regions.ts. Leaves regions, events, event_chain_links,
// teams, and users untouched — login accounts and static content are never
// affected by a reset.
export async function POST() {
  const { session, error } = await requireInstructor();
  if (error) return error;

  // Order matters: children before the parents they reference.
  await db.delete(scores); // -> decisions
  await db.delete(decisions); // -> eventDispatches
  await db.delete(coordinationMessages); // -> eventDispatches (nullable)
  await db.delete(globalFeedItems); // -> eventDispatches (nullable)
  await db.delete(teamNotifications); // -> eventDispatches (nullable)
  await db.delete(resourcePledges); // -> eventDispatches (nullable)
  await db.delete(snapVoteResponses); // -> snapVotes
  await db.delete(snapVotes);
  await db.delete(announcementAcks); // -> announcements
  await db.delete(announcements); // -> eventDispatches (nullable)
  await db.delete(budgetCycleDonations); // -> budgetCycles
  await db.delete(budgetCycleResponses); // -> budgetCycles
  await db.delete(budgetCycles);
  await db.delete(marketRequests);
  await db.delete(regionTradeOffers);
  await db.delete(emergencyFundingContributions); // -> emergencyFundingRequests
  await db.delete(emergencyFundingRequests);
  await db.delete(eventDispatches);
  await db.delete(modelStateHistory);
  await db.delete(instructorActions);

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
      .where(eq(modelState.regionId, r.id));

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
      .where(eq(modelStateOptimal.regionId, r.id));
  }

  await db
    .update(globalState)
    .set({
      currentDay: 1,
      escalationState: "GREEN",
      mediaPressureIndex: 0,
      simulationStatus: "not_started",
      simulationStartedAt: null,
      pausedAccumulatedMs: 0,
      pausedAt: null,
      lastDriftAppliedAt: null,
      whoHqFund: 500_000_000,
      whoHqPpeStock: 2000,
      whoHqAntiviralsStock: 200_000,
      lastBudgetCycleNarrativeDay: 0,
      updatedAt: new Date(),
    })
    .where(eq(globalState.id, 1));

  // Logged after the wipe so it's the first entry in the fresh action log.
  await db.insert(instructorActions).values({
    instructorUserId: Number(session!.user.id),
    actionType: "simulation_reset",
    targetDesc: "all decisions, scores, dispatches, and model state reset to seeded starting values",
  });

  return NextResponse.json({ ok: true });
}
