// Creates and destroys a game session. No db.transaction() anywhere (the
// Neon HTTP driver throws on it at runtime — see lib/db-atomic.ts) — instead
// createSession fails toward "orphaned but invisible" rather than
// "half-built but live": every read path filters sessions on
// `status != 'setup'`, so a crash between steps 1-5 below just leaves a
// setup-status row for the reaper (Phase 5) to eventually delete, and
// nothing ever observes a live session with missing regions.
import bcrypt from "bcryptjs";
import { db } from "./db";
import {
  gameSessions,
  sessionState,
  teams,
  modelState,
  modelStateOptimal,
  sessionRegionCredentials,
  decisions,
  scores,
  coordinationMessages,
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
  eventDispatches,
  modelStateHistory,
  instructorActions,
} from "./db/schema";
import { eq } from "drizzle-orm";
import { regionSeed } from "./db/seed-data/regions";
import { generateSessionId, generateSecret, generateUsernameSuffix } from "./ids";

export async function createSession(ownerUserId: number, mode: "instructor" | "demo"): Promise<string> {
  const sessionId = generateSessionId();

  // 1. Identity row, not yet joinable.
  await db.insert(gameSessions).values({
    id: sessionId,
    ownerUserId,
    mode,
    status: "setup",
    displayToken: generateSecret(24),
  });

  // 2. Wide per-tick state row, all column defaults from the schema.
  await db.insert(sessionState).values({ sessionId });

  // 3-4. One team + starting model_state/model_state_optimal per region.
  for (const r of regionSeed) {
    const [team] = await db.insert(teams).values({ sessionId, regionId: r.id }).returning();

    await db.insert(modelState).values({
      sessionId,
      regionId: r.id,
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
    });

    await db.insert(modelStateOptimal).values({
      sessionId,
      regionId: r.id,
      rt: r.startingRt,
      cfrMultiplier: r.startingCfrMultiplier,
      confirmedCases: r.startingConfirmed,
      estimatedTrueCasesLow: r.startingEstTrueLow,
      estimatedTrueCasesHigh: r.startingEstTrueHigh,
      deaths: r.startingDeaths,
      publicTrustIndex: r.startingPublicTrust,
      populationHappinessIndex: 60,
    });

    // 5. Instructor mode only — generated per-region region logins. Demo
    // mode has no student logins at all (see gameSessions.demoActiveRegionId
    // — the session owner occupies regions directly, Phase 4).
    if (mode === "instructor" && team) {
      const password = generateSecret(9);
      const passwordHash = await bcrypt.hash(password, 10);
      await db.insert(sessionRegionCredentials).values({
        sessionId,
        regionId: r.id,
        username: `${r.id.toLowerCase()}-${generateUsernameSuffix()}`,
        passwordHash,
        plaintextHint: password,
      });
    }
  }

  // 6. Commit point.
  await db.update(gameSessions).set({ status: "running", startedAt: new Date() }).where(eq(gameSessions.id, sessionId));

  return sessionId;
}

// Deletes every row belonging to a session, in FK-dependency order — mirrors
// app/api/instructor/reset/route.ts's per-session delete ordering, just
// without the re-seed step at the end.
export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(scores).where(eq(scores.sessionId, sessionId));
  await db.delete(decisions).where(eq(decisions.sessionId, sessionId));
  await db.delete(coordinationMessages).where(eq(coordinationMessages.sessionId, sessionId));
  await db.delete(globalFeedItems).where(eq(globalFeedItems.sessionId, sessionId));
  await db.delete(teamNotifications).where(eq(teamNotifications.sessionId, sessionId));
  await db.delete(resourcePledges).where(eq(resourcePledges.sessionId, sessionId));
  await db.delete(snapVoteResponses).where(eq(snapVoteResponses.sessionId, sessionId));
  await db.delete(snapVotes).where(eq(snapVotes.sessionId, sessionId));
  await db.delete(announcementAcks).where(eq(announcementAcks.sessionId, sessionId));
  await db.delete(announcements).where(eq(announcements.sessionId, sessionId));
  await db.delete(budgetCycleDonations).where(eq(budgetCycleDonations.sessionId, sessionId));
  await db.delete(budgetCycleResponses).where(eq(budgetCycleResponses.sessionId, sessionId));
  await db.delete(budgetCycles).where(eq(budgetCycles.sessionId, sessionId));
  await db.delete(marketRequests).where(eq(marketRequests.sessionId, sessionId));
  await db.delete(regionTradeOffers).where(eq(regionTradeOffers.sessionId, sessionId));
  await db.delete(emergencyFundingContributions).where(eq(emergencyFundingContributions.sessionId, sessionId));
  await db.delete(emergencyFundingRequests).where(eq(emergencyFundingRequests.sessionId, sessionId));
  await db.delete(socialMilestoneAwards).where(eq(socialMilestoneAwards.sessionId, sessionId));
  await db.delete(eventDispatches).where(eq(eventDispatches.sessionId, sessionId));
  await db.delete(modelStateHistory).where(eq(modelStateHistory.sessionId, sessionId));
  await db.delete(instructorActions).where(eq(instructorActions.sessionId, sessionId));
  await db.delete(modelState).where(eq(modelState.sessionId, sessionId));
  await db.delete(modelStateOptimal).where(eq(modelStateOptimal.sessionId, sessionId));
  await db.delete(teams).where(eq(teams.sessionId, sessionId));
  await db.delete(sessionRegionCredentials).where(eq(sessionRegionCredentials.sessionId, sessionId));
  await db.delete(sessionState).where(eq(sessionState.sessionId, sessionId));
  await db.delete(gameSessions).where(eq(gameSessions.id, sessionId));
}
