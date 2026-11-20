// Class-session region setup (Release 3): which regions a human team plays
// and which a computer plays, and how strong each computer player is. Stored
// in sessionRegionAutoplay (enabled = computer-run). Can be changed at any
// time, e.g. to hand a region whose team is absent to the computer mid-game;
// the computer then answers that region's open events on the next tick.
import { db } from "./db";
import { sessionRegionAutoplay } from "./db/schema";
import { eq } from "drizzle-orm";
import { REGIONS, type RegionId } from "./regions";
import type { CompetenceProfile } from "./autoplayer";

export interface RegionSetup {
  regionId: RegionId;
  computer: boolean;
  profile: CompetenceProfile;
}

const PROFILES: CompetenceProfile[] = ["strong", "mixed", "struggling"];

export async function getRegionSetup(sessionId: string): Promise<RegionSetup[]> {
  const rows = await db.query.sessionRegionAutoplay.findMany({ where: eq(sessionRegionAutoplay.sessionId, sessionId) });
  return REGIONS.map((regionId) => {
    const row = rows.find((r) => r.regionId === regionId);
    return { regionId, computer: !!row?.enabled, profile: row?.profile ?? "mixed" };
  });
}

export function parseRegionSetup(input: unknown): RegionSetup[] | null {
  if (!Array.isArray(input)) return null;
  const out: RegionSetup[] = [];
  for (const item of input) {
    const r = item as Partial<RegionSetup>;
    if (!REGIONS.includes(r.regionId as RegionId) || typeof r.computer !== "boolean" || !PROFILES.includes(r.profile as CompetenceProfile)) return null;
    out.push({ regionId: r.regionId as RegionId, computer: r.computer, profile: r.profile as CompetenceProfile });
  }
  return out;
}

export async function saveRegionSetup(sessionId: string, setup: RegionSetup[]): Promise<void> {
  for (const r of setup) {
    await db
      .insert(sessionRegionAutoplay)
      .values({ sessionId, regionId: r.regionId, profile: r.profile, enabled: r.computer })
      .onConflictDoUpdate({
        target: [sessionRegionAutoplay.sessionId, sessionRegionAutoplay.regionId],
        set: { profile: r.profile, enabled: r.computer },
      });
  }
}

export async function computerRegionIds(sessionId: string): Promise<string[]> {
  return (await getRegionSetup(sessionId)).filter((r) => r.computer).map((r) => r.regionId);
}
