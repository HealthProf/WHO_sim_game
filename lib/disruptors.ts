// Mid-event disruptors engine (Release 5); content in
// lib/db/seed-data/disruptors.ts. Pure helpers plus the consequence step.
//
// Planning happens once per dispatch at release (lib/dispatch.ts): each
// applicable disruptor is drawn with its probability, and if drawn gets an
// "at" time between 15% and 50% of the decision window. The plan is stored
// on the dispatch (eventDispatches.disruptionsJson). Teams only ever see
// disruptions whose time has come (app/api/events filters the rest), so a
// planned surprise can't be read early.
import { db } from "./db";
import { eventDispatches, globalFeedItems, sessionState, teamNotifications, teams } from "./db/schema";
import { and, eq, sql } from "drizzle-orm";
import { disruptorSeed, type DisruptorSeed } from "./db/seed-data/disruptors";
import { applyModelDelta } from "./model-engine";
import { disruptorById } from "./disruptor-content";

export interface PlannedDisruption {
  id: string;
  at: string; // ISO time it takes effect
}

export { disruptorById };

export function planDisruptions(
  eventId: string,
  regionId: string,
  dispatchedAt: Date,
  deadlineAt: Date | null,
  rng: () => number = Math.random
): PlannedDisruption[] {
  if (!deadlineAt) return [];
  const windowMs = deadlineAt.getTime() - dispatchedAt.getTime();
  if (windowMs <= 0) return [];
  return disruptorSeed
    .filter((d) => d.eventId === eventId && (!d.regions || d.regions.includes(regionId)))
    .filter((d) => rng() < d.probability)
    .map((d) => ({ id: d.id, at: new Date(dispatchedAt.getTime() + windowMs * (0.15 + rng() * 0.35)).toISOString() }));
}

export function activeDisruptions(planned: unknown, at: Date = new Date()): DisruptorSeed[] {
  if (!Array.isArray(planned)) return [];
  return (planned as PlannedDisruption[])
    .filter((p) => new Date(p.at).getTime() <= at.getTime())
    .map((p) => disruptorById(p.id))
    .filter((d): d is DisruptorSeed => !!d);
}

// Options a team can no longer pick at the given time.
export function removedOptions(planned: unknown, at: Date = new Date()): Map<string, DisruptorSeed> {
  const out = new Map<string, DisruptorSeed>();
  for (const d of activeDisruptions(planned, at)) if (d.kind === "remove") for (const o of d.options) out.set(o, d);
  return out;
}

// Only the disruptions a team is allowed to see yet (for API responses).
export function visibleDisruptions(planned: unknown, at: Date = new Date()): PlannedDisruption[] {
  if (!Array.isArray(planned)) return [];
  return (planned as PlannedDisruption[]).filter((p) => new Date(p.at).getTime() <= at.getTime());
}

// Applies "warn" consequences for a scored decision whose choice was warned
// at the time it was submitted. Called once per scored decision (the
// dispatch is claimed before scoring, so this can't run twice for it).
export async function applyDisruptionConsequences(opts: {
  sessionId: string;
  dispatch: typeof eventDispatches.$inferSelect;
  structuredChoice: string | null;
  submittedAt: Date;
  regionId: string;
}): Promise<string[]> {
  const { sessionId, dispatch, structuredChoice, submittedAt, regionId } = opts;
  if (!structuredChoice) return [];
  const hits = activeDisruptions(dispatch.disruptionsJson, submittedAt).filter((d) => d.kind === "warn" && d.options.includes(structuredChoice));
  const applied: string[] = [];
  for (const d of hits) {
    const c = d.consequence ?? {};
    if (c.deltas?.length) {
      await applyModelDelta({ sessionId, deltas: c.deltas, submittingRegionId: regionId, reason: `${d.id}: ${d.headline}` });
    }
    if (c.whoFundPct) {
      const keep = 1 - c.whoFundPct / 100;
      // One atomic statement (no read-then-write).
      await db
        .update(sessionState)
        .set({ whoHqFund: sql`floor(${sessionState.whoHqFund} * ${keep}::numeric)::int`, updatedAt: new Date() })
        .where(eq(sessionState.sessionId, sessionId));
      const headline = `${d.headline}: after ${regionId}'s decision, WHO's emergency fund shrank by ${c.whoFundPct}%. Less is now available for every region's purchases and emergency requests.`;
      await db.insert(globalFeedItems).values({ sessionId, headlineText: headline });
      const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });
      await db.insert(teamNotifications).values(allTeams.map((t) => ({ sessionId, teamId: t.id, kind: "consequence", message: headline })));
    }
    applied.push(d.id);
  }
  return applied;
}

export async function dispatchRegion(sessionId: string, dispatch: typeof eventDispatches.$inferSelect): Promise<string | null> {
  if (!dispatch.targetTeamId) return null;
  const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.id, dispatch.targetTeamId)) });
  return team?.regionId ?? null;
}
