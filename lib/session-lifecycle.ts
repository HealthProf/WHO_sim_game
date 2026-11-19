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
  sessionRegionAutoplay,
  cheatCodeAttempts,
  cheatCodeRedemptions,
  cheatRegionEffects,
  cheatCodeState,
} from "./db/schema";
import { and, eq, ne } from "drizzle-orm";
import { regionSeed } from "./db/seed-data/regions";
import { generateSessionId, generateSecret, generateUsernameSuffix, generateReadablePassword } from "./ids";
import {
  DEMO_GAME_DAYS_PER_REAL_MINUTE,
  DEMO_FAST_MODE_MULTIPLIER,
  SCENARIO_OVERVIEW_PREROLL_SECONDS,
  CLASS_DEFAULT_DURATION_MINUTES,
  CLASS_DECISION_WINDOW_BASE_MINUTES,
} from "./config";
import { rateForDuration } from "./game-duration";
import { pathogenFor, randomPathogenId, startingRtFor, type PathogenId } from "./pathogens";
import { logSessionEvent } from "./session-events";
import { logAnalyticsEvent } from "./analytics";

// Two of each profile across the six regions, shuffled per session so no
// two demo runs feel identical (see lib/config.ts AUTOPLAY_PROFILE_DISTRIBUTIONS).
const DEMO_PROFILE_POOL: ("strong" | "mixed" | "struggling")[] = ["strong", "strong", "mixed", "mixed", "struggling", "struggling"];
function shuffled<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export async function createSession(ownerUserId: number, mode: "instructor" | "demo", opts: { pathogenId?: PathogenId } = {}): Promise<string> {
  // Release 5: each game is about one of four pathogens, drawn at random
  // unless specified (lib/pathogens.ts).
  const pathogen = pathogenFor(opts.pathogenId ?? randomPathogenId());
  const sessionId = generateSessionId();

  // 1. Identity row, not yet joinable.
  await db.insert(gameSessions).values({
    id: sessionId,
    ownerUserId,
    mode,
    status: "setup",
    displayToken: generateSecret(24),
  });

  // 2. Wide per-tick state row. Demo mode runs on a faster clock so a solo
  // visitor can finish an arc in ~10-15 minutes (see lib/config.ts) —
  // instructor mode keeps the schema defaults. Demo mode also starts the
  // Update 3 Scenario Overview deck immediately (no login step for an
  // instructor to press a button from — see the "Scenario Overview" button
  // on the credential sheet, which is Class Session mode's equivalent
  // trigger). Instructor mode deliberately leaves scenarioOverviewStartedAt
  // null here; it's set only by that button or by a reset.
  //
  // Set a few seconds in the future rather than "now" — see
  // SCENARIO_OVERVIEW_PREROLL_SECONDS's comment in lib/config.ts for why:
  // without this buffer, the client discovering the deck (page load, first
  // poll) ate directly into slide 1's on-screen time.
  await db.insert(sessionState).values(
    mode === "demo"
      ? {
          sessionId,
          gameDaysPerRealMinute: DEMO_GAME_DAYS_PER_REAL_MINUTE,
          targetDurationMinutes: Math.round(90 / DEMO_GAME_DAYS_PER_REAL_MINUTE),
          computerFacilitator: true,
          pathogenId: pathogen.id,
          fastModeMultiplier: DEMO_FAST_MODE_MULTIPLIER,
          scenarioOverviewStartedAt: new Date(Date.now() + SCENARIO_OVERVIEW_PREROLL_SECONDS * 1000),
        }
      : {
          // Class sessions: paced to a 75-minute default play time, with a
          // reading/writing floor on every decision window (lib/config.ts).
          sessionId,
          targetDurationMinutes: CLASS_DEFAULT_DURATION_MINUTES,
          gameDaysPerRealMinute: rateForDuration(90, CLASS_DEFAULT_DURATION_MINUTES),
          decisionWindowBaseMinutes: CLASS_DECISION_WINDOW_BASE_MINUTES,
          pathogenId: pathogen.id,
        }
  );

  // Demo mode: assign each region a shuffled competence profile up front —
  // every region starts autoplayed; the owner "occupies" one at a time via
  // gameSessions.demoActiveRegionId (lib/session-context.ts), which the
  // autoplayer skips while occupied (lib/autoplayer, lib/deadline.ts).
  const demoProfiles = mode === "demo" ? shuffled(DEMO_PROFILE_POOL) : null;

  // 3-4. One team + starting model_state/model_state_optimal per region.
  for (const [index, r] of regionSeed.entries()) {
    const [team] = await db.insert(teams).values({ sessionId, regionId: r.id }).returning();

    await db.insert(modelState).values({
      sessionId,
      regionId: r.id,
      day: 1,
      rt: startingRtFor(r.startingRt, pathogen),
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
      rt: startingRtFor(r.startingRt, pathogen),
      cfrMultiplier: r.startingCfrMultiplier,
      confirmedCases: r.startingConfirmed,
      estimatedTrueCasesLow: r.startingEstTrueLow,
      estimatedTrueCasesHigh: r.startingEstTrueHigh,
      deaths: r.startingDeaths,
      publicTrustIndex: r.startingPublicTrust,
      populationHappinessIndex: 60,
    });

    // 5. Instructor mode only — generated per-region region logins. Demo
    // mode has no student logins at all — the session owner occupies
    // regions directly (gameSessions.demoActiveRegionId), and every region
    // not currently occupied is driven by the scripted autoplayer.
    if (mode === "instructor" && team) {
      // 6 chars from the 32-symbol unambiguous alphabet is ~1.07 billion
      // combinations — far beyond what SIGNIN_MAX_ATTEMPTS_PER_CREDENTIAL's
      // rate limit (lib/auth.ts) lets an attacker try, and quick enough to
      // type correctly on a phone under time pressure at the start of class.
      const password = generateReadablePassword(6);
      const passwordHash = await bcrypt.hash(password, 10);
      await db.insert(sessionRegionCredentials).values({
        sessionId,
        regionId: r.id,
        username: `${r.id.toLowerCase()}-${generateUsernameSuffix()}`,
        passwordHash,
        plaintextHint: password,
      });
    } else if (mode === "demo") {
      await db.insert(sessionRegionAutoplay).values({
        sessionId,
        regionId: r.id,
        profile: demoProfiles![index],
        enabled: true,
      });
    }
  }

  // 6. Commit point.
  await db.update(gameSessions).set({ status: "running", startedAt: new Date() }).where(eq(gameSessions.id, sessionId));
  await logSessionEvent({ sessionId, kind: "created", mode });
  await logAnalyticsEvent({ sessionId, mode, eventType: "session_created", userId: ownerUserId });

  return sessionId;
}

// Called from PATCH /api/instructor/simulation when a session transitions to
// "completed". sessionRegionCredentials.plaintextHint and the credential
// sheet's display fallback ("(cleared after the session completed)") both
// documented this happening, but nothing ever actually did it — plaintext
// region passwords were persisting indefinitely. bcrypt's passwordHash is
// untouched, so a reopened session ("completed" is soft and reversible, see
// that route's header comment) keeps its region logins working; only the
// printable plaintext copy is gone. Pulled out as its own function (rather
// than inlined in the route) so it's testable without importing lib/auth —
// see tests/cheat-codes.test.ts's header comment on why route handlers that
// transitively import next-auth can't be exercised directly under Vitest.
export async function clearSessionCredentialSecrets(sessionId: string): Promise<void> {
  await db.update(sessionRegionCredentials).set({ plaintextHint: null }).where(eq(sessionRegionCredentials.sessionId, sessionId));
}

// Ends a session for good from the owner's side ("End session and start
// new"): archives it so POST /api/sessions will allow a fresh session of the
// same mode, and so its region logins stop working (lib/auth-verify.ts and
// lib/session-context.ts both refuse archived sessions). Ownership is checked
// in the same UPDATE that archives, so a foreign session id is a no-op and the
// caller returns 404. Data is kept until the reaper's normal post-archive
// deletion window (lib/config.ts REAP_DELETE_*), so a class session's debrief
// data isn't destroyed the moment the facilitator moves on.
export async function endSession(sessionId: string, ownerUserId: number): Promise<{ id: string; mode: "instructor" | "demo" } | null> {
  const [ended] = await db
    .update(gameSessions)
    .set({ status: "archived", completedAt: new Date(), demoActiveRegionId: null })
    .where(and(eq(gameSessions.id, sessionId), eq(gameSessions.ownerUserId, ownerUserId), ne(gameSessions.status, "archived")))
    .returning();
  if (!ended) return null;
  await clearSessionCredentialSecrets(sessionId);
  await logSessionEvent({ sessionId, kind: "archived", mode: ended.mode, detail: "ended by owner" });
  return { id: ended.id, mode: ended.mode };
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
  // Any session that ever had a cheat code entered carries rows in these
  // four tables, all of which reference gameSessions — omitting them here
  // caused a foreign-key violation whenever the reaper (lib/reaper.ts) tried
  // to delete such a session. None of the four are referenced by any other
  // table, so deletion order among them doesn't matter.
  await db.delete(cheatCodeAttempts).where(eq(cheatCodeAttempts.sessionId, sessionId));
  await db.delete(cheatCodeRedemptions).where(eq(cheatCodeRedemptions.sessionId, sessionId));
  await db.delete(cheatRegionEffects).where(eq(cheatRegionEffects.sessionId, sessionId));
  await db.delete(cheatCodeState).where(eq(cheatCodeState.sessionId, sessionId));
  await db.delete(modelState).where(eq(modelState.sessionId, sessionId));
  await db.delete(modelStateOptimal).where(eq(modelStateOptimal.sessionId, sessionId));
  await db.delete(teams).where(eq(teams.sessionId, sessionId));
  await db.delete(sessionRegionCredentials).where(eq(sessionRegionCredentials.sessionId, sessionId));
  await db.delete(sessionRegionAutoplay).where(eq(sessionRegionAutoplay.sessionId, sessionId));
  await db.delete(sessionState).where(eq(sessionState.sessionId, sessionId));
  await db.delete(gameSessions).where(eq(gameSessions.id, sessionId));
}
