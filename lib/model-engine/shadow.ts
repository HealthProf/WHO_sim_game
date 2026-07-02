// Counterfactual "Optimal" shadow simulation (see modelStateOptimal in
// lib/db/schema.ts and simulation-docs — item 7 of the debrief redesign).
//
// Only a subset of ModelDelta fields exist on the shadow table (it tracks
// epidemic/social outcomes, not the resource economy — fund/PPE/antivirals
// deltas simply don't apply to "what if every call had been Optimal").

import { db } from "../db";
import { modelStateOptimal } from "../db/schema";
import { eq } from "drizzle-orm";
import type { ModelDelta } from "../db/seed-data/events";
import { REGIONS as ALL_REGIONS } from "../regions";
import { clamp } from "./core";

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
