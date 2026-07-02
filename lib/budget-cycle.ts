// Periodic budget cycle (item 2) — fires every 14 narrative days on the
// existing game-day clock (lib/sim-clock.ts). When one is due, the
// instructor picks a mode from the Control page:
//   - "default": push the standard disbursement to every region immediately
//   - "custom": instructor sets a per-region amount before pushing
//   - "snap_vote": each region gets a timed window to accept the default or
//     request more; if anyone requests more, a second timed window asks
//     every accepting region how much of their own disbursement they want
//     to donate to the requester(s), pooled and split proportionally to
//     each requester's ask.
//
// The default per-region amount is 12% of that region's *starting* fund
// (not its current fund, so this doesn't compound runaway or punish a
// region that spent wisely) — a flat, predictable "regular resupply."

import { db } from "./db";
import {
  budgetCycles,
  budgetCycleResponses,
  budgetCycleDonations,
  globalState,
  modelState,
  modelStateHistory,
  regions,
  teams,
  teamNotifications,
  globalFeedItems,
  instructorActions,
} from "./db/schema";
import { and, eq } from "drizzle-orm";
import { computeSimClock } from "./sim-clock";

const CYCLE_INTERVAL_NARRATIVE_DAYS = 14;
const DEFAULT_DISBURSEMENT_PCT = 0.12;
const RESPONSE_WINDOW_SECONDS = 90;
const DONATION_WINDOW_SECONDS = 90;

export function defaultAmountForRegion(startingFund: number): number {
  return Math.round(startingFund * DEFAULT_DISBURSEMENT_PCT);
}

// Called opportunistically (same poll-driven pattern as deadline
// enforcement/passive drift) — creates a new pending cycle when due, and
// auto-resolves any snap-vote phase whose timer has expired.
export async function processBudgetCycleTimers() {
  const gs = await db.query.globalState.findFirst({ where: eq(globalState.id, 1) });
  if (!gs || gs.simulationStatus !== "running" || !gs.simulationStartedAt) return;

  const clock = computeSimClock({
    simulationStatus: gs.simulationStatus,
    simulationStartedAt: gs.simulationStartedAt,
    pausedAccumulatedMs: gs.pausedAccumulatedMs,
    pausedAt: gs.pausedAt,
    gameDaysPerRealMinute: gs.gameDaysPerRealMinute,
    totalGameDays: gs.totalGameDays,
  });
  const currentNarrativeDay = clock.gameDay;

  const openCycle = await db.query.budgetCycles.findFirst({
    where: (t, { ne }) => ne(t.status, "closed"),
    orderBy: (t, { desc }) => [desc(t.id)],
  });

  if (!openCycle) {
    if (currentNarrativeDay >= gs.lastBudgetCycleNarrativeDay + CYCLE_INTERVAL_NARRATIVE_DAYS) {
      const priorCycles = await db.query.budgetCycles.findMany();
      await db.insert(budgetCycles).values({
        cycleNumber: priorCycles.length + 1,
        narrativeDayDue: currentNarrativeDay,
        status: "pending_instructor",
      });
    }
    return;
  }

  const now = new Date();
  if (openCycle.status === "collecting_responses" && openCycle.closesAt && openCycle.closesAt <= now) {
    await closeResponsePhase(openCycle.id);
  } else if (openCycle.status === "collecting_donations" && openCycle.closesAt && openCycle.closesAt <= now) {
    await closeDonationPhaseAndDisburse(openCycle.id);
  }
}

export async function pushDefaultDisbursement(cycleId: number, actorUserId: number) {
  const allRegions = await db.query.regions.findMany();
  for (const r of allRegions) {
    const amount = defaultAmountForRegion(r.startingFund);
    await disburseToRegion(r.id, amount, `Budget cycle: standard disbursement ($${amount.toLocaleString()})`);
    const team = await db.query.teams.findFirst({ where: eq(teams.regionId, r.id) });
    if (team) {
      await db.insert(budgetCycleResponses).values({ budgetCycleId: cycleId, teamId: team.id, choice: "accept", amountDisbursed: amount });
    }
  }
  await closeCycle(cycleId, "default");
  await announceGlobally(`Budget cycle disbursed: standard resupply pushed to all six regions.`);
  await db.insert(instructorActions).values({ instructorUserId: actorUserId, actionType: "budget_cycle_default", targetDesc: `Cycle ${cycleId}: standard disbursement to all regions` });
}

export async function pushCustomDisbursement(cycleId: number, amounts: Record<string, number>, actorUserId: number) {
  for (const [regionId, amount] of Object.entries(amounts)) {
    await disburseToRegion(regionId, amount, `Budget cycle: instructor-adjusted disbursement ($${amount.toLocaleString()})`);
    const team = await db.query.teams.findFirst({ where: eq(teams.regionId, regionId) });
    if (team) {
      await db.insert(budgetCycleResponses).values({ budgetCycleId: cycleId, teamId: team.id, choice: "accept", amountDisbursed: amount });
    }
  }
  await closeCycle(cycleId, "custom");
  await announceGlobally(`Budget cycle disbursed: instructor-adjusted amounts pushed to all six regions.`);
  await db.insert(instructorActions).values({ instructorUserId: actorUserId, actionType: "budget_cycle_custom", targetDesc: `Cycle ${cycleId}: custom disbursement` });
}

export async function startSnapVoteCycle(cycleId: number, actorUserId: number) {
  const closesAt = new Date(Date.now() + RESPONSE_WINDOW_SECONDS * 1000);
  await db.update(budgetCycles).set({ mode: "snap_vote", status: "collecting_responses", closesAt }).where(eq(budgetCycles.id, cycleId));
  await announceGlobally(`Budget cycle open: regions have ${RESPONSE_WINDOW_SECONDS}s to accept the standard disbursement or request more.`);
  const allTeams = await db.query.teams.findMany();
  for (const team of allTeams) {
    await db.insert(teamNotifications).values({ teamId: team.id, kind: "budget_cycle", message: `Budget cycle: accept your standard disbursement, or request more (you have ${RESPONSE_WINDOW_SECONDS}s).` });
  }
  await db.insert(instructorActions).values({ instructorUserId: actorUserId, actionType: "budget_cycle_snap_vote_started", targetDesc: `Cycle ${cycleId}` });
}

export async function submitBudgetResponse(cycleId: number, teamId: number, choice: "accept" | "request_more", requestedAmount?: number) {
  const cycle = await db.query.budgetCycles.findFirst({ where: eq(budgetCycles.id, cycleId) });
  if (!cycle || cycle.status !== "collecting_responses") throw new Error("This budget cycle is not currently open for responses.");
  const existing = await db.query.budgetCycleResponses.findFirst({ where: and(eq(budgetCycleResponses.budgetCycleId, cycleId), eq(budgetCycleResponses.teamId, teamId)) });
  if (existing) throw new Error("Your team has already responded to this budget cycle.");
  await db.insert(budgetCycleResponses).values({ budgetCycleId: cycleId, teamId, choice, requestedAmount: requestedAmount ?? null });
}

async function closeResponsePhase(cycleId: number) {
  const responses = await db.query.budgetCycleResponses.findMany({ where: eq(budgetCycleResponses.budgetCycleId, cycleId) });
  const allTeams = await db.query.teams.findMany();
  const respondedTeamIds = new Set(responses.map((r) => r.teamId));

  // Non-responding teams are treated as accepting the default.
  for (const team of allTeams) {
    if (!respondedTeamIds.has(team.id)) {
      await db.insert(budgetCycleResponses).values({ budgetCycleId: cycleId, teamId: team.id, choice: "accept" });
    }
  }

  const requesters = responses.filter((r) => r.choice === "request_more");
  if (requesters.length === 0) {
    await disburseAcceptedDefaults(cycleId);
    await closeCycle(cycleId, "snap_vote");
    await announceGlobally(`Budget cycle: all regions accepted the standard disbursement.`);
    return;
  }

  // Someone requested more — open the donation phase for everyone else.
  const closesAt = new Date(Date.now() + DONATION_WINDOW_SECONDS * 1000);
  await db.update(budgetCycles).set({ status: "collecting_donations", closesAt }).where(eq(budgetCycles.id, cycleId));
  const requesterRegions = await Promise.all(requesters.map(async (r) => (await db.query.teams.findFirst({ where: eq(teams.id, r.teamId) }))?.regionId));
  await announceGlobally(`Budget cycle: ${requesterRegions.filter(Boolean).join(", ")} requested additional funding — other regions have ${DONATION_WINDOW_SECONDS}s to donate part of their disbursement.`);
  for (const team of allTeams) {
    if (!requesters.some((r) => r.teamId === team.id)) {
      await db.insert(teamNotifications).values({
        teamId: team.id,
        kind: "budget_cycle",
        message: `${requesterRegions.filter(Boolean).join(", ")} requested extra funding this cycle — donate part of your own disbursement if you want to help (${DONATION_WINDOW_SECONDS}s window).`,
      });
    }
  }
}

export async function submitDonation(cycleId: number, fromTeamId: number, amount: number) {
  const cycle = await db.query.budgetCycles.findFirst({ where: eq(budgetCycles.id, cycleId) });
  if (!cycle || cycle.status !== "collecting_donations") throw new Error("This budget cycle is not currently open for donations.");
  const myResponse = await db.query.budgetCycleResponses.findFirst({ where: and(eq(budgetCycleResponses.budgetCycleId, cycleId), eq(budgetCycleResponses.teamId, fromTeamId)) });
  if (myResponse?.choice === "request_more") throw new Error("Your region already requested additional funding this cycle.");

  const team = await db.query.teams.findFirst({ where: eq(teams.id, fromTeamId) });
  const region = team ? await db.query.regions.findFirst({ where: eq(regions.id, team.regionId) }) : null;
  if (!region) throw new Error("Region not found");
  const myDefault = defaultAmountForRegion(region.startingFund);
  if (amount > myDefault) throw new Error(`You can donate at most your own disbursement ($${myDefault.toLocaleString()}).`);

  const requesters = await db.query.budgetCycleResponses.findMany({ where: and(eq(budgetCycleResponses.budgetCycleId, cycleId), eq(budgetCycleResponses.choice, "request_more")) });
  if (requesters.length === 0) throw new Error("No region requested additional funding this cycle.");

  // One donation row per donor per cycle — upsert-by-delete-then-insert
  // since donors may adjust their pledge before the window closes.
  await db.delete(budgetCycleDonations).where(and(eq(budgetCycleDonations.budgetCycleId, cycleId), eq(budgetCycleDonations.fromTeamId, fromTeamId), eq(budgetCycleDonations.toTeamId, requesters[0].teamId)));
  await db.insert(budgetCycleDonations).values({ budgetCycleId: cycleId, fromTeamId, toTeamId: requesters[0].teamId, amount });
}

async function closeDonationPhaseAndDisburse(cycleId: number) {
  const responses = await db.query.budgetCycleResponses.findMany({ where: eq(budgetCycleResponses.budgetCycleId, cycleId) });
  const donations = await db.query.budgetCycleDonations.findMany({ where: eq(budgetCycleDonations.budgetCycleId, cycleId) });
  const requesters = responses.filter((r) => r.choice === "request_more");
  const totalRequested = requesters.reduce((sum, r) => sum + (r.requestedAmount ?? 0), 0);
  const totalDonated = donations.reduce((sum, d) => sum + d.amount, 0);

  const donatedByTeam = new Map<number, number>();
  for (const d of donations) donatedByTeam.set(d.fromTeamId, (donatedByTeam.get(d.fromTeamId) ?? 0) + d.amount);

  for (const response of responses) {
    const team = await db.query.teams.findFirst({ where: eq(teams.id, response.teamId) });
    if (!team) continue;
    const region = await db.query.regions.findFirst({ where: eq(regions.id, team.regionId) });
    if (!region) continue;
    const base = defaultAmountForRegion(region.startingFund);

    let finalAmount: number;
    if (response.choice === "request_more") {
      const share = totalRequested > 0 ? ((response.requestedAmount ?? 0) / totalRequested) * totalDonated : 0;
      finalAmount = Math.round(base + share);
    } else {
      finalAmount = base - (donatedByTeam.get(response.teamId) ?? 0);
    }

    await disburseToRegion(team.regionId, finalAmount, `Budget cycle: resolved disbursement after donation round ($${finalAmount.toLocaleString()})`);
    await db.update(budgetCycleResponses).set({ amountDisbursed: finalAmount }).where(eq(budgetCycleResponses.id, response.id));
  }

  await closeCycle(cycleId, "snap_vote");
  await announceGlobally(`Budget cycle resolved — $${totalDonated.toLocaleString()} donated to cover additional requests this round.`);
}

async function disburseAcceptedDefaults(cycleId: number) {
  const responses = await db.query.budgetCycleResponses.findMany({ where: eq(budgetCycleResponses.budgetCycleId, cycleId) });
  for (const response of responses) {
    const team = await db.query.teams.findFirst({ where: eq(teams.id, response.teamId) });
    if (!team) continue;
    const region = await db.query.regions.findFirst({ where: eq(regions.id, team.regionId) });
    if (!region) continue;
    const amount = defaultAmountForRegion(region.startingFund);
    await disburseToRegion(team.regionId, amount, `Budget cycle: standard disbursement ($${amount.toLocaleString()})`);
    await db.update(budgetCycleResponses).set({ amountDisbursed: amount }).where(eq(budgetCycleResponses.id, response.id));
  }
}

async function disburseToRegion(regionId: string, amount: number, reason: string) {
  const state = await db.query.modelState.findFirst({ where: eq(modelState.regionId, regionId) });
  if (!state) return;
  const next = Math.max(0, state.fundRemaining + amount);
  await db.update(modelState).set({ fundRemaining: next, updatedAt: new Date() }).where(eq(modelState.regionId, regionId));
  await db.insert(modelStateHistory).values({ regionId, day: state.day, snapshotJson: { ...state, fundRemaining: next }, reason });
}

async function closeCycle(cycleId: number, mode: "default" | "custom" | "snap_vote") {
  const gs = await db.query.globalState.findFirst({ where: eq(globalState.id, 1) });
  const cycle = await db.query.budgetCycles.findFirst({ where: eq(budgetCycles.id, cycleId) });
  await db.update(budgetCycles).set({ status: "closed", mode, closedAt: new Date() }).where(eq(budgetCycles.id, cycleId));
  if (gs && cycle) {
    await db.update(globalState).set({ lastBudgetCycleNarrativeDay: cycle.narrativeDayDue }).where(eq(globalState.id, 1));
  }
}

async function announceGlobally(message: string) {
  await db.insert(globalFeedItems).values({ headlineText: message });
}
