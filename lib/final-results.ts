// Item 7: the debrief's opening "final results" comparison — how this
// specific playthrough actually went vs. the counterfactual "what if every
// decision had been Optimal" trajectory that's been running in lockstep the
// whole session (see modelStateOptimal in lib/db/schema.ts and
// applyOptimalShadowDelta in lib/model-engine.ts).

import { db } from "./db";

export interface RegionFinalResult {
  regionId: string;
  actualConfirmed: number;
  actualDeaths: number;
  optimalConfirmed: number;
  optimalDeaths: number;
  infectionsPrevented: number; // actual - optimal, floored at 0 (positive = optimal would have prevented this many)
  deathsPrevented: number;
}

export interface FinalResults {
  regions: RegionFinalResult[];
  totalActualConfirmed: number;
  totalActualDeaths: number;
  totalOptimalConfirmed: number;
  totalOptimalDeaths: number;
  totalInfectionsPrevented: number;
  totalDeathsPrevented: number;
}

export async function computeFinalResults(): Promise<FinalResults> {
  const actual = await db.query.modelState.findMany();
  const optimal = await db.query.modelStateOptimal.findMany();

  const regionResults: RegionFinalResult[] = actual.map((a) => {
    const o = optimal.find((x) => x.regionId === a.regionId);
    const optimalConfirmed = o?.confirmedCases ?? a.confirmedCases;
    const optimalDeaths = o?.deaths ?? a.deaths;
    return {
      regionId: a.regionId,
      actualConfirmed: a.confirmedCases,
      actualDeaths: a.deaths,
      optimalConfirmed,
      optimalDeaths,
      infectionsPrevented: Math.max(0, a.confirmedCases - optimalConfirmed),
      deathsPrevented: Math.max(0, a.deaths - optimalDeaths),
    };
  });

  return {
    regions: regionResults,
    totalActualConfirmed: regionResults.reduce((s, r) => s + r.actualConfirmed, 0),
    totalActualDeaths: regionResults.reduce((s, r) => s + r.actualDeaths, 0),
    totalOptimalConfirmed: regionResults.reduce((s, r) => s + r.optimalConfirmed, 0),
    totalOptimalDeaths: regionResults.reduce((s, r) => s + r.optimalDeaths, 0),
    totalInfectionsPrevented: regionResults.reduce((s, r) => s + r.infectionsPrevented, 0),
    totalDeathsPrevented: regionResults.reduce((s, r) => s + r.deathsPrevented, 0),
  };
}
