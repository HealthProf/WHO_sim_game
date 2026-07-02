// Item 12's single "world health bar" — one shared composite number for the
// whole room to watch together, instead of six regions' worth of numbers
// competing for attention. Deliberately a simple weighted blend of what's
// already computed elsewhere (never a new data source): global average
// trust and happiness carry the most weight since they're the most
// direct read on "how is this actually going," escalation state and
// global Rt pull it down as the crisis objectively worsens.
import { clamp } from "./model-engine";

const ESCALATION_SCORE: Record<string, number> = { GREEN: 100, AMBER: 55, RED: 15 };

export interface WorldHealth {
  index: number; // 0-100, higher is better
  label: string;
}

export function computeWorldHealth(opts: { avgPublicTrust: number; avgHappiness: number; escalationState: string; globalRt: number }): WorldHealth {
  const escalationScore = ESCALATION_SCORE[opts.escalationState] ?? 50;
  const rtScore = clamp(100 - opts.globalRt * 15, 0, 100);

  const index = Math.round(opts.avgPublicTrust * 0.3 + opts.avgHappiness * 0.3 + escalationScore * 0.25 + rtScore * 0.15);

  let label: string;
  if (index >= 75) label = "Thriving";
  else if (index >= 55) label = "Holding Steady";
  else if (index >= 35) label = "Strained";
  else if (index >= 15) label = "Critical";
  else label = "Collapse";

  return { index: clamp(index, 0, 100), label };
}
