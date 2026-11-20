// Shared R&D fund (Release 5 playtest request): regions pool money into
// research on a countermeasure for this game's pathogen. Funding milestones
// stand for trial phases completing and have modeled effects; reaching the
// last one early makes a countermeasure available ahead of schedule and lets
// the facilitator release the vaccine event sooner. Rushing it has a risk:
// if the final phase completes before the story's halfway point, there's a
// RUSH_BACKLASH_CHANCE that fast-tracked approval fuels hesitancy (public
// trust falls everywhere). Rolled once per game, stable per session.
//
// Money moves with the atomic helpers (lib/db-atomic.ts): the region is
// debited first with a conditional update; the fund is credited in one
// statement (total and the per-region breakdown together). Milestones are
// claimed with a guarded update, so each fires exactly once even if two
// contributions land together. All queries are scoped to the session.
import { db } from "./db";
import { globalFeedItems, sessionState, teamNotifications, teams } from "./db/schema";
import { and, eq, lt, sql } from "drizzle-orm";
import { tryDeductRegionField } from "./db-atomic";
import { applyModelDelta } from "./model-engine";
import { pathogenFor } from "./pathogens";
import { computeGameDaysElapsed, computeRealElapsedMs } from "./sim-clock";
import { stableFraction } from "./autoplayer/economy";
import type { ModelDelta } from "./db/seed-data/events";

export interface Milestone {
  level: number;
  fund: number;
  name: string;
  effect: string;
  deltas: ModelDelta[];
}

// DRAFT values for review: amounts sized against regional budgets
// ($12M-$210M) so several regions must pool to reach the later phases.
export const RD_MILESTONES: Milestone[] = [
  {
    level: 1,
    fund: 30_000_000,
    name: "Phase 1 complete",
    effect: "Safety data in hand; trial sites share better clinical-care protocols (death-rate multiplier -0.05 everywhere).",
    deltas: [{ field: "cfrMultiplier", region: "GLOBAL", delta: -0.05 }],
  },
  {
    level: 2,
    fund: 70_000_000,
    name: "Phase 2 complete",
    effect: "Dose and early efficacy established; surveillance labs gain validated tests (surveillance +1 everywhere).",
    deltas: [{ field: "surveillanceIndex", region: "GLOBAL", delta: 1 }],
  },
  {
    level: 3,
    fund: 120_000_000,
    name: "Phase 3 complete: countermeasure ready early",
    effect: "An accelerated countermeasure becomes available (Rt -0.15 and death-rate multiplier -0.1 everywhere). The facilitator can release the vaccine allocation event early.",
    deltas: [
      { field: "rt", region: "GLOBAL", delta: -0.15 },
      { field: "cfrMultiplier", region: "GLOBAL", delta: -0.1 },
    ],
  },
];

export const RUSH_BACKLASH_CHANCE = 0.5;
export const RUSH_BEFORE_STORY_FRACTION = 0.5;
const BACKLASH_TRUST = -8;

export function productFor(pathogenId: string | null | undefined): string {
  const p = pathogenFor(pathogenId);
  switch (p.id) {
    case "flu":
      return "a strain-matched vaccine";
    case "plague":
      return "a plague vaccine candidate and next-generation antibiotics";
    case "nipah":
      return "a monoclonal antibody and vaccine candidate";
    default:
      return "a vaccine";
  }
}

export type ContributeResult = { ok: true; fund: number; newMilestones: Milestone[] } | { ok: false; status: number; error: string };

export async function contributeToResearch(sessionId: string, regionId: string, amount: number): Promise<ContributeResult> {
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, status: 400, error: "Amount must be a positive whole number" };
  // Region funds are int4 columns: anything larger can't be afforded, and
  // sending it to Postgres would overflow into a 500 instead of a refusal.
  if (amount > 2_147_483_647) return { ok: false, status: 400, error: "Your region doesn't have that much available." };
  const debited = await tryDeductRegionField(sessionId, regionId, "fundRemaining", amount);
  if (!debited) return { ok: false, status: 400, error: "Your region doesn't have that much available." };

  const [row] = await db
    .update(sessionState)
    .set({
      rdFund: sql`${sessionState.rdFund} + ${amount}`,
      rdContributions: sql`jsonb_set(coalesce(${sessionState.rdContributions}, '{}'::jsonb), ARRAY[${regionId}]::text[], to_jsonb(coalesce((${sessionState.rdContributions}->>${regionId})::bigint, 0) + ${amount}))`,
      updatedAt: new Date(),
    })
    .where(eq(sessionState.sessionId, sessionId))
    .returning();

  const newMilestones = await checkMilestones(sessionId, row?.rdFund ?? 0);
  return { ok: true, fund: row?.rdFund ?? 0, newMilestones };
}

async function announce(sessionId: string, headline: string) {
  await db.insert(globalFeedItems).values({ sessionId, headlineText: headline });
  const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });
  await db.insert(teamNotifications).values(allTeams.map((t) => ({ sessionId, teamId: t.id, kind: "research", message: headline })));
}

export async function checkMilestones(sessionId: string, fund: number, now: Date = new Date()): Promise<Milestone[]> {
  const reached = RD_MILESTONES.filter((m) => fund >= m.fund);
  const fired: Milestone[] = [];
  for (const m of reached) {
    // Claim this level only if it hasn't been reached yet (exactly once).
    const claimed = await db
      .update(sessionState)
      .set({ rdMilestone: m.level })
      .where(and(eq(sessionState.sessionId, sessionId), lt(sessionState.rdMilestone, m.level)))
      .returning();
    if (claimed.length === 0) continue;
    const gs = claimed[0];
    const product = productFor(gs.pathogenId);
    await applyModelDelta({ sessionId, deltas: m.deltas, submittingRegionId: "AFRO", reason: `Shared R&D: ${m.name}` });
    await announce(sessionId, `Shared R&D fund: ${m.name} on ${product}. ${m.effect}`);
    fired.push(m);
    if (m.level === RD_MILESTONES.length) await maybeRushBacklash(sessionId, gs, now);
  }
  return fired;
}

async function maybeRushBacklash(sessionId: string, gs: typeof sessionState.$inferSelect, now: Date) {
  const claimed = await db
    .update(sessionState)
    .set({ rdBacklashRolled: true })
    .where(and(eq(sessionState.sessionId, sessionId), eq(sessionState.rdBacklashRolled, false)))
    .returning();
  if (claimed.length === 0) return;
  const total = gs.totalGameDays > 0 ? gs.totalGameDays : 90;
  const progress = gs.simulationStartedAt ? computeGameDaysElapsed(gs, computeRealElapsedMs(gs, now.getTime())) / total : 0;
  if (progress >= RUSH_BEFORE_STORY_FRACTION) return;
  if (stableFraction(`${sessionId}:rd-backlash`) >= RUSH_BACKLASH_CHANCE) return;
  await applyModelDelta({
    sessionId,
    deltas: [{ field: "publicTrustIndex", region: "GLOBAL", delta: BACKLASH_TRUST }],
    submittingRegionId: "AFRO",
    reason: "Shared R&D: fast-tracked approval fuels hesitancy",
  });
  await announce(
    sessionId,
    `Fast-tracked approval fuels hesitancy: with all trial phases compressed into weeks, commentators question whether ${productFor(gs.pathogenId)} was properly tested. Public trust falls everywhere (about ${-BACKLASH_TRUST} points).`
  );
}
