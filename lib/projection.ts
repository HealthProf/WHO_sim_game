// Item 5's private "situation projection" — a team-facing forward forecast
// answering "if nothing changes, where does this go?" using the exact same
// growth math that actually drives the live simulation (see
// computeEpidemicGrowth/confirmedCaseCeiling in lib/model-engine.ts), held
// at the region's *current* Rt/CFR/surveillance rather than simulating any
// hypothetical future decisions. This is deliberately private per-region —
// it's meant to sharpen a team's own anticipation, not hand every region a
// forecast of its rivals' trajectories.

import { computeEpidemicGrowth, confirmedCaseCeiling } from "./model-engine";

export interface ProjectionPoint {
  narrativeDay: number; // days from now
  confirmedCases: number;
  deaths: number;
}

export interface Projection {
  points: ProjectionPoint[]; // day 0 (now), 3, 7
  assumedRt: number;
  narrative: string;
}

const PROJECTION_HORIZON_DAYS = [3, 7];

export function projectForward(state: {
  regionId: string;
  rt: number;
  cfrMultiplier: number;
  confirmedCases: number;
  estimatedTrueCasesLow: number;
  estimatedTrueCasesHigh: number;
  surveillanceIndex: number;
}): Projection {
  const ceiling = confirmedCaseCeiling(state.regionId, state.surveillanceIndex);

  const points: ProjectionPoint[] = [{ narrativeDay: 0, confirmedCases: state.confirmedCases, deaths: 0 }];
  let runningConfirmed = state.confirmedCases;
  let runningDeaths = 0;
  let elapsedSoFar = 0;

  for (const horizon of PROJECTION_HORIZON_DAYS) {
    const stepDays = horizon - elapsedSoFar;
    const growth = computeEpidemicGrowth(
      { rt: state.rt, cfrMultiplier: state.cfrMultiplier, confirmedCases: runningConfirmed, estimatedTrueCasesLow: state.estimatedTrueCasesLow, estimatedTrueCasesHigh: state.estimatedTrueCasesHigh },
      stepDays,
      ceiling
    );
    runningConfirmed += growth.newConfirmed;
    runningDeaths += growth.newDeaths;
    elapsedSoFar = horizon;
    points.push({ narrativeDay: horizon, confirmedCases: runningConfirmed, deaths: runningDeaths });
  }

  const narrative =
    state.rt >= 1
      ? `At your current Rt (${state.rt.toFixed(2)}), transmission is still growing — no new containment decision means this keeps climbing.`
      : `At your current Rt (${state.rt.toFixed(2)}), transmission is shrinking — sustained containment is actually working right now.`;

  return { points, assumedRt: state.rt, narrative };
}
