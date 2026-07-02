// "Break-glass" Emergency Committee snap vote — a facilitator-triggered
// synchronous mini-event, separate from the scripted 16-event queue. It
// exists as a pacing/pressure tool: usable at any moment to recenter the
// whole room on the same clock, test coordination under acute time pressure,
// or inject urgency if a session is dragging.
//
// Deliberately not per-question authored content: closing a vote applies a
// small generic model effect based on participation and agreement level
// (near-unanimous vs. split), plus a minor penalty to regions that didn't
// participate at all — so it's consequential without needing bespoke
// modelDelta authoring for every possible question an instructor might ask.

import { db } from "./db";
import { snapVotes, snapVoteResponses, teamNotifications, globalFeedItems } from "./db/schema";
import { and, eq, lte } from "drizzle-orm";
import { applyModelDelta } from "./model-engine";

export interface SnapVoteTally {
  optionCounts: Record<string, number>;
  respondedTeamIds: number[];
  totalTeams: number;
}

export async function tallyForVote(voteId: number): Promise<SnapVoteTally> {
  const responses = await db.query.snapVoteResponses.findMany({ where: eq(snapVoteResponses.snapVoteId, voteId) });
  const allTeams = await db.query.teams.findMany();
  const optionCounts: Record<string, number> = {};
  for (const r of responses) optionCounts[r.choice] = (optionCounts[r.choice] ?? 0) + 1;
  return { optionCounts, respondedTeamIds: responses.map((r) => r.teamId), totalTeams: allTeams.length };
}

export async function closeSnapVote(voteId: number) {
  const vote = await db.query.snapVotes.findFirst({ where: eq(snapVotes.id, voteId) });
  if (!vote || vote.status === "closed") return null;

  const tally = await tallyForVote(voteId);
  const respondedCount = tally.respondedTeamIds.length;
  const counts = Object.values(tally.optionCounts);
  const topCount = counts.length > 0 ? Math.max(...counts) : 0;
  const majorityShare = respondedCount > 0 ? topCount / respondedCount : 0;

  let mediaDelta: number;
  let summary: string;
  if (respondedCount >= 5 && majorityShare >= 0.8) {
    mediaDelta = -5;
    summary = `Near-unanimous (${topCount}/${respondedCount} responding) — WHO speaks with one voice, media pressure eases.`;
  } else if (respondedCount < 4 || majorityShare < 0.6) {
    mediaDelta = 8;
    summary = `Committee split (${respondedCount}/${tally.totalTeams} regions responded, no clear majority) — visible discord, media pressure rises.`;
  } else {
    mediaDelta = -2;
    summary = `Majority agreement reached (${topCount}/${respondedCount} responding).`;
  }

  await applyModelDelta({
    deltas: [{ field: "mediaPressureIndex", region: "GLOBAL", delta: mediaDelta }],
    submittingRegionId: "AFRO", // ignored — mediaPressureIndex deltas are global regardless of submitting region
    reason: `Snap vote closed: "${vote.question}" — ${summary}`,
  });

  const allTeams = await db.query.teams.findMany();
  for (const team of allTeams) {
    if (!tally.respondedTeamIds.includes(team.id)) {
      await applyModelDelta({
        deltas: [{ field: "politicalTensionIndex", region: "SELF", delta: 5 }],
        submittingRegionId: team.regionId,
        reason: `Snap vote closed: did not participate in "${vote.question}"`,
      });
    }
  }

  await db.update(snapVotes).set({ status: "closed", resultSummary: summary }).where(eq(snapVotes.id, voteId));

  await db.insert(globalFeedItems).values({ headlineText: `EMERGENCY COMMITTEE RESULT — "${vote.question}": ${summary}` });
  await db.insert(teamNotifications).values(
    allTeams.map((team) => ({
      teamId: team.id,
      kind: "snap_vote",
      message: `Emergency Committee vote closed — "${vote.question}": ${summary}`,
    }))
  );

  return { vote, tally, summary };
}

// Called opportunistically from lib/deadline.ts's processDeadlines() (same
// poll-driven pattern as deadline enforcement) so an open vote whose timer
// expired gets tallied even if the instructor doesn't click "Close & Tally."
export async function closeExpiredSnapVotes() {
  const now = new Date();
  const expired = await db.query.snapVotes.findMany({
    where: and(eq(snapVotes.status, "open"), lte(snapVotes.closesAt, now)),
  });
  for (const v of expired) {
    await closeSnapVote(v.id);
  }
}

export interface SnapVoteView {
  id: number;
  question: string;
  options: string[];
  createdAt: Date;
  closesAt: Date;
  status: "open" | "closed";
  resultSummary: string | null;
  respondedCount: number;
  totalTeams: number;
  optionCounts?: Record<string, number>; // only populated for closed votes, or for the instructor
  myChoice?: string | null;
}

// Teams only see live response *counts* while a vote is open (not the
// breakdown) so they can't herd-vote off what other regions are doing —
// the full breakdown is revealed once the vote closes. The instructor
// always sees the live breakdown.
export async function getSnapVoteState(opts: { forInstructor: boolean; teamId?: number | null }): Promise<{
  current: SnapVoteView | null;
  history: SnapVoteView[];
}> {
  const open = await db.query.snapVotes.findFirst({ where: eq(snapVotes.status, "open") });
  const recentClosed = await db.query.snapVotes.findMany({
    where: eq(snapVotes.status, "closed"),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
    limit: 5,
  });

  let current: SnapVoteView | null = null;
  if (open) {
    const tally = await tallyForVote(open.id);
    let myChoice: string | null | undefined = undefined;
    if (opts.teamId) {
      const mine = await db.query.snapVoteResponses.findFirst({
        where: and(eq(snapVoteResponses.snapVoteId, open.id), eq(snapVoteResponses.teamId, opts.teamId)),
      });
      myChoice = mine?.choice ?? null;
    }
    current = {
      id: open.id,
      question: open.question,
      options: open.optionsJson as string[],
      createdAt: open.createdAt,
      closesAt: open.closesAt,
      status: "open",
      resultSummary: null,
      respondedCount: tally.respondedTeamIds.length,
      totalTeams: tally.totalTeams,
      optionCounts: opts.forInstructor ? tally.optionCounts : undefined,
      myChoice,
    };
  }

  const history = await Promise.all(
    recentClosed.map(async (v): Promise<SnapVoteView> => {
      const tally = await tallyForVote(v.id);
      return {
        id: v.id,
        question: v.question,
        options: v.optionsJson as string[],
        createdAt: v.createdAt,
        closesAt: v.closesAt,
        status: "closed",
        resultSummary: v.resultSummary,
        respondedCount: tally.respondedTeamIds.length,
        totalTeams: tally.totalTeams,
        optionCounts: tally.optionCounts,
      };
    })
  );

  return { current, history };
}

export async function createSnapVote(opts: {
  question: string;
  options: string[];
  durationSeconds: number;
  createdByUserId: number;
}) {
  // Only one open vote at a time — supersede (close without a real tally
  // effect beyond what's already accrued) any still-open vote first.
  const existingOpen = await db.query.snapVotes.findFirst({ where: eq(snapVotes.status, "open") });
  if (existingOpen) {
    await closeSnapVote(existingOpen.id);
  }

  const closesAt = new Date(Date.now() + opts.durationSeconds * 1000);
  const [vote] = await db
    .insert(snapVotes)
    .values({
      question: opts.question,
      optionsJson: opts.options,
      createdByUserId: opts.createdByUserId,
      closesAt,
    })
    .returning();

  await db.insert(globalFeedItems).values({
    headlineText: `EMERGENCY COMMITTEE CALLED: "${opts.question}" — all regions must respond`,
  });
  const allTeams = await db.query.teams.findMany();
  await db.insert(teamNotifications).values(
    allTeams.map((team) => ({
      teamId: team.id,
      kind: "snap_vote",
      message: `Emergency Committee called: "${opts.question}" — respond now.`,
    }))
  );

  return vote;
}
