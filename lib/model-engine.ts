// Applies an event's per-tier modelDelta to live model_state, appends to
// model_state_history (append-only — never discard), and recomputes the
// global escalation state. See simulation-docs/01-scenario.md § Decision ->
// Model Impact and § Escalation States.

import { db } from "./db";
import { modelState, modelStateHistory, globalState, regions } from "./db/schema";
import { eq } from "drizzle-orm";
import type { Tier, ModelDelta } from "./db/seed-data/events";

const ALL_REGIONS = ["AFRO", "AMRO", "EMRO", "EURO", "SEARO", "WPRO"] as const;

export async function applyModelDelta(opts: {
  deltas: ModelDelta[];
  submittingRegionId: string;
  reason: string;
}) {
  const { deltas, submittingRegionId, reason } = opts;

  const affectedRegions = new Set<string>();

  for (const delta of deltas) {
    if (delta.field === "mediaPressureIndex") {
      const gs = await db.query.globalState.findFirst({ where: eq(globalState.id, 1) });
      const current = gs?.mediaPressureIndex ?? 0;
      const next = clamp(current + delta.delta, 0, 100);
      await db.update(globalState).set({ mediaPressureIndex: next, updatedAt: new Date() }).where(eq(globalState.id, 1));
      continue;
    }

    const targetRegions = delta.region === "SELF" ? [submittingRegionId] : delta.region === "GLOBAL" ? [...ALL_REGIONS] : [delta.region];

    for (const regionId of targetRegions) {
      await applyFieldDelta(regionId, delta.field, delta.delta);
      affectedRegions.add(regionId);
    }
  }

  for (const regionId of affectedRegions) {
    const state = await db.query.modelState.findFirst({ where: eq(modelState.regionId, regionId) });
    if (state) {
      await db.insert(modelStateHistory).values({
        regionId,
        day: state.day,
        snapshotJson: state,
        reason,
      });
    }
  }

  await recomputeEscalationState();
}

const FIELD_BOUNDS: Record<string, [number, number]> = {
  rt: [0, 10],
  cfrMultiplier: [0, 10],
  surveillanceIndex: [0, 10],
  hospitalCapacityPct: [0, 100],
  politicalTensionIndex: [0, 100],
  publicTrustIndex: [0, 100],
};

export async function applyFieldDelta(
  regionId: string,
  field: Exclude<ModelDelta["field"], "mediaPressureIndex">,
  delta: number
) {
  const state = await db.query.modelState.findFirst({ where: eq(modelState.regionId, regionId) });
  if (!state) return;

  const [min, max] = FIELD_BOUNDS[field] ?? [-Infinity, Infinity];
  const next = clamp((state[field] as number) + delta, min, max);

  await db
    .update(modelState)
    .set({ [field]: next, updatedAt: new Date() } as never)
    .where(eq(modelState.regionId, regionId));
}

export function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// Thresholds for "this swing is big enough to auto-surface" (see
// lib/consequences.ts). Deliberately generous — these should only catch
// genuinely dramatic single-decision swings, not routine Adequate-tier
// nudges, so the projector/team-dashboard callouts stay meaningful.
const SIGNIFICANT_DELTA_THRESHOLDS: Partial<Record<ModelDelta["field"], number>> = {
  rt: 0.2,
  cfrMultiplier: 0.3,
  politicalTensionIndex: 15,
  publicTrustIndex: 15,
  mediaPressureIndex: 15,
  surveillanceIndex: 3,
  hospitalCapacityPct: 15,
};

export function isSignificantDelta(deltas: ModelDelta[]): boolean {
  return deltas.some((d) => Math.abs(d.delta) >= (SIGNIFICANT_DELTA_THRESHOLDS[d.field] ?? Infinity));
}

// Escalation state per simulation-docs/01-scenario.md § Escalation States.
export async function recomputeEscalationState() {
  const allRegions = await db.query.regions.findMany();
  const allStates = await db.query.modelState.findMany();

  let weightedRtSum = 0;
  let weightSum = 0;
  for (const region of allRegions) {
    const state = allStates.find((s) => s.regionId === region.id);
    if (!state) continue;
    weightedRtSum += state.rt * region.populationWeight;
    weightSum += region.populationWeight;
  }
  const globalRt = weightSum > 0 ? weightedRtSum / weightSum : 0;

  const recentCriticalFailures = await countRecentCriticalFailures();

  let escalation: "GREEN" | "AMBER" | "RED" = "GREEN";
  if (globalRt > 4.0 || recentCriticalFailures >= 2) {
    escalation = "RED";
  } else if (globalRt >= 2.5 || recentCriticalFailures >= 1) {
    escalation = "AMBER";
  }

  await db.update(globalState).set({ escalationState: escalation, updatedAt: new Date() }).where(eq(globalState.id, 1));

  return { globalRt, escalation };
}

async function countRecentCriticalFailures(): Promise<number> {
  // Simplified: count all-time critical failures scored in the current day
  // rather than a rolling 24h window, which is an acceptable prototype
  // simplification given the compressed fast-mode timescale.
  const { scores, decisions } = await import("./db/schema");
  const rows = await db
    .select({ tier: scores.tier })
    .from(scores)
    .innerJoin(decisions, eq(scores.decisionId, decisions.id));
  return rows.filter((r) => r.tier === "CRITICAL_FAILURE").length;
}

export async function computeGlobalRt(): Promise<number> {
  const allRegions = await db.query.regions.findMany();
  const allStates = await db.query.modelState.findMany();
  let weightedRtSum = 0;
  let weightSum = 0;
  for (const region of allRegions) {
    const state = allStates.find((s) => s.regionId === region.id);
    if (!state) continue;
    weightedRtSum += state.rt * region.populationWeight;
    weightSum += region.populationWeight;
  }
  return weightSum > 0 ? weightedRtSum / weightSum : 0;
}

// Passive drift: "the virus doesn't wait for you." A small continuous Rt
// creep applied to every region while the simulation is running, independent
// of any scored decision — so idle real time between dispatched events still
// carries a cost, and the escalation state can climb on its own if teams
// stall. Batched into >=2-minute increments (rather than applied on every
// ~15s poll) so it doesn't spam model_state_history with tiny rows.
const DRIFT_RATE_PER_MINUTE = 0.015; // Rt units per real minute, per region
const DRIFT_BATCH_MINUTES = 2;

export async function applyPassiveDrift(gs?: { simulationStatus: string; lastDriftAppliedAt: Date | null; simulationStartedAt: Date | null }) {
  const state = gs ?? (await db.query.globalState.findFirst({ where: eq(globalState.id, 1) }));
  if (!state || state.simulationStatus !== "running") return;

  const now = new Date();
  const last = state.lastDriftAppliedAt ? new Date(state.lastDriftAppliedAt) : state.simulationStartedAt ? new Date(state.simulationStartedAt) : now;
  const elapsedMinutes = (now.getTime() - last.getTime()) / 60_000;
  if (elapsedMinutes < DRIFT_BATCH_MINUTES) return;

  const delta = DRIFT_RATE_PER_MINUTE * elapsedMinutes;
  const allRegions = await db.query.regions.findMany();
  for (const region of allRegions) {
    await applyFieldDelta(region.id, "rt", delta);
    const updated = await db.query.modelState.findFirst({ where: eq(modelState.regionId, region.id) });
    if (updated) {
      await db.insert(modelStateHistory).values({
        regionId: region.id,
        day: updated.day,
        snapshotJson: updated,
        reason: "Passive drift: no active containment measures scored recently",
      });
    }
  }

  await db.update(globalState).set({ lastDriftAppliedAt: now }).where(eq(globalState.id, 1));
  await recomputeEscalationState();
}
