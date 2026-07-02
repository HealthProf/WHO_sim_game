// Applies an event's per-tier modelDelta to live model_state, appends to
// model_state_history (append-only — never discard), and recomputes the
// global escalation state. See simulation-docs/01-scenario.md § Decision ->
// Model Impact and § Escalation States.

import { db } from "./db";
import { modelState, modelStateOptimal, modelStateHistory, globalState } from "./db/schema";
import { eq } from "drizzle-orm";
import type { ModelDelta } from "./db/seed-data/events";

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
  populationHappinessIndex: [0, 100],
  hcwSurgePct: [0, 100],
  fundRemaining: [0, Infinity],
  ppeDaysRemaining: [0, Infinity],
  antiviralsRemaining: [0, Infinity],
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
  populationHappinessIndex: 15,
  fundRemaining: 5_000_000,
  ppeDaysRemaining: 10,
  antiviralsRemaining: 2000,
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

// --- Counterfactual "Optimal" shadow simulation (see modelStateOptimal in
// lib/db/schema.ts and simulation-docs — item 7 of the debrief redesign) ---
//
// Only a subset of ModelDelta fields exist on the shadow table (it tracks
// epidemic/social outcomes, not the resource economy — fund/PPE/antivirals
// deltas simply don't apply to "what if every call had been Optimal").
const SHADOW_FIELDS = new Set(["rt", "cfrMultiplier", "publicTrustIndex", "populationHappinessIndex"]);
const SHADOW_BOUNDS: Record<string, [number, number]> = {
  rt: [0, 10],
  cfrMultiplier: [0, 10],
  publicTrustIndex: [0, 100],
  populationHappinessIndex: [0, 100],
};

// Called alongside applyModelDelta specifically from the scoring code paths
// (never from budget/market/pledge/snap-vote mechanics, which aren't a
// per-event decision tier) — mirrors the event's OPTIMAL-tier deltas onto
// the shadow table regardless of what tier actually happened.
export async function applyOptimalShadowDelta(deltas: ModelDelta[], submittingRegionId: string) {
  for (const delta of deltas) {
    if (!SHADOW_FIELDS.has(delta.field)) continue;
    const targetRegions = delta.region === "SELF" ? [submittingRegionId] : delta.region === "GLOBAL" ? [...ALL_REGIONS] : [delta.region];
    for (const regionId of targetRegions) {
      const state = await db.query.modelStateOptimal.findFirst({ where: eq(modelStateOptimal.regionId, regionId) });
      if (!state) continue;
      const [min, max] = SHADOW_BOUNDS[delta.field] ?? [-Infinity, Infinity];
      const next = clamp((state[delta.field as keyof typeof state] as number) + delta.delta, min, max);
      await db
        .update(modelStateOptimal)
        .set({ [delta.field]: next, updatedAt: new Date() } as never)
        .where(eq(modelStateOptimal.regionId, regionId));
    }
  }
}

// Passive drift: "the virus doesn't wait for you." A small continuous Rt
// creep applied to every region while the simulation is running, independent
// of any scored decision — so idle real time between dispatched events still
// carries a cost, and the escalation state can climb on its own if teams
// stall. Batched into >=2-minute increments (rather than applied on every
// ~15s poll) so it doesn't spam model_state_history with tiny rows.
//
// This same tick also advances the epidemic curve itself — confirmedCases,
// estimatedTrueCases, and deaths were previously never touched by *any* code
// path (only rt/cfrMultiplier/etc. moved), so the case/death numbers on
// every dashboard and the public display map sat frozen at their Day-1 seed
// values for the entire session regardless of what teams decided. Growth is
// scaled by each region's *current* Rt/CFR multiplier, so it's directly
// responsive to decisions: good NPI calls visibly slow case growth for the
// rest of the session, a CFR-multiplier spike visibly worsens the death
// count relative to new cases from that point on.
//
// The identical formula also runs against modelStateOptimal (using ITS OWN
// rt/cfrMultiplier, which only ever received Optimal-tier deltas) so the
// counterfactual trajectory develops in lockstep with the real one across
// the whole session, not just at the moments a decision was scored.
const DRIFT_RATE_PER_MINUTE = 0.015; // Rt units per real minute, per region
const DRIFT_BATCH_MINUTES = 2;
const BASE_CFR = 0.008; // 0.8% base CFR per 01-scenario.md, before the regional multiplier

// Population happiness (item 8) drifts down slightly with every new death
// this tick and with sustained escalation, independent of any single event's
// modelDelta — general public morale erodes just from the crisis dragging on.
const HAPPINESS_ESCALATION_DRAIN: Record<string, number> = { GREEN: 0, AMBER: 0.15, RED: 0.4 };

function computeEpidemicGrowth(before: { rt: number; cfrMultiplier: number; confirmedCases: number; estimatedTrueCasesLow: number; estimatedTrueCasesHigh: number }, elapsedMinutes: number) {
  const growthRatePerMinute = clamp(0.002 + before.rt * 0.006, 0, 0.05);
  const newConfirmed = Math.max(1, Math.round(before.confirmedCases * growthRatePerMinute * elapsedMinutes));
  const trueCaseGrowthFactor = before.confirmedCases > 0 ? (before.confirmedCases + newConfirmed) / before.confirmedCases : 1;
  const newDeaths = Math.max(0, Math.round(newConfirmed * BASE_CFR * before.cfrMultiplier));
  return {
    newConfirmed,
    newDeaths,
    newEstTrueLow: Math.round(before.estimatedTrueCasesLow * trueCaseGrowthFactor),
    newEstTrueHigh: Math.round(before.estimatedTrueCasesHigh * trueCaseGrowthFactor),
  };
}

export async function applyPassiveDrift(gs?: { simulationStatus: string; lastDriftAppliedAt: Date | null; simulationStartedAt: Date | null; escalationState?: string }) {
  const state = gs ?? (await db.query.globalState.findFirst({ where: eq(globalState.id, 1) }));
  if (!state || state.simulationStatus !== "running") return;

  const now = new Date();
  const last = state.lastDriftAppliedAt ? new Date(state.lastDriftAppliedAt) : state.simulationStartedAt ? new Date(state.simulationStartedAt) : now;
  const elapsedMinutes = (now.getTime() - last.getTime()) / 60_000;
  if (elapsedMinutes < DRIFT_BATCH_MINUTES) return;

  const rtDelta = DRIFT_RATE_PER_MINUTE * elapsedMinutes;
  const escalationState = state.escalationState ?? (await db.query.globalState.findFirst({ where: eq(globalState.id, 1) }))?.escalationState ?? "GREEN";
  const happinessDrain = HAPPINESS_ESCALATION_DRAIN[escalationState] ?? 0;

  const allRegions = await db.query.regions.findMany();
  for (const region of allRegions) {
    const before = await db.query.modelState.findFirst({ where: eq(modelState.regionId, region.id) });
    if (!before) continue;

    await applyFieldDelta(region.id, "rt", rtDelta);

    const growth = computeEpidemicGrowth(before, elapsedMinutes);
    const happinessLoss = Math.round(happinessDrain * elapsedMinutes + growth.newDeaths * 0.05);

    await db
      .update(modelState)
      .set({
        confirmedCases: before.confirmedCases + growth.newConfirmed,
        estimatedTrueCasesLow: growth.newEstTrueLow,
        estimatedTrueCasesHigh: growth.newEstTrueHigh,
        deaths: before.deaths + growth.newDeaths,
        populationHappinessIndex: clamp(before.populationHappinessIndex - happinessLoss, 0, 100),
        updatedAt: new Date(),
      })
      .where(eq(modelState.regionId, region.id));

    const updated = await db.query.modelState.findFirst({ where: eq(modelState.regionId, region.id) });
    if (updated) {
      await db.insert(modelStateHistory).values({
        regionId: region.id,
        day: updated.day,
        snapshotJson: updated,
        reason: "Passive drift: outbreak progression + no active containment measures scored recently",
      });
    }

    // Mirror the same passage-of-time effects onto the shadow simulation,
    // using ITS OWN rt/cfrMultiplier (which diverges from the real one as
    // Optimal-tier deltas accumulate differently than actual ones).
    const shadow = await db.query.modelStateOptimal.findFirst({ where: eq(modelStateOptimal.regionId, region.id) });
    if (shadow) {
      const shadowRt = clamp(shadow.rt + rtDelta, 0, 10);
      const shadowGrowth = computeEpidemicGrowth({ ...shadow, rt: shadow.rt }, elapsedMinutes);
      const shadowHappinessLoss = Math.round(happinessDrain * elapsedMinutes + shadowGrowth.newDeaths * 0.05);
      await db
        .update(modelStateOptimal)
        .set({
          rt: shadowRt,
          confirmedCases: shadow.confirmedCases + shadowGrowth.newConfirmed,
          estimatedTrueCasesLow: shadowGrowth.newEstTrueLow,
          estimatedTrueCasesHigh: shadowGrowth.newEstTrueHigh,
          deaths: shadow.deaths + shadowGrowth.newDeaths,
          populationHappinessIndex: clamp(shadow.populationHappinessIndex - shadowHappinessLoss, 0, 100),
          updatedAt: new Date(),
        })
        .where(eq(modelStateOptimal.regionId, region.id));
    }
  }

  await db.update(globalState).set({ lastDriftAppliedAt: now }).where(eq(globalState.id, 1));
  await recomputeEscalationState();
}
