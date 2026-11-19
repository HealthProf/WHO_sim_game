// Database-free lookup of disruptor content (client-safe); the engine that
// plans and applies them is lib/disruptors.ts.
import { disruptorSeed, type DisruptorSeed } from "./db/seed-data/disruptors";

const BY_ID = new Map(disruptorSeed.map((d) => [d.id, d]));

export function disruptorById(id: string): DisruptorSeed | undefined {
  return BY_ID.get(id);
}
