import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";
import {
  regions,
  teams,
  users,
  modelState,
  modelStateOptimal,
  globalState,
  events,
  eventChainLinks,
} from "../lib/db/schema";
import { regionSeed } from "../lib/db/seed-data/regions";
import { eventSeed } from "../lib/db/seed-data/events";
import { fixedPasswords } from "../lib/db/seed-data/credentials";

async function main() {
  console.log("Seeding regions...");
  for (const r of regionSeed) {
    await db.insert(regions).values(r).onConflictDoUpdate({ target: regions.id, set: r });
  }

  console.log("Seeding events...");
  for (const e of eventSeed) {
    const { chainPrev, ...eventRow } = e;
    await db.insert(events).values(eventRow).onConflictDoUpdate({ target: events.id, set: eventRow });
  }
  for (const e of eventSeed) {
    for (const prev of e.chainPrev) {
      await db.insert(eventChainLinks).values({ prevEventId: prev, nextEventId: e.id }).onConflictDoNothing();
    }
  }

  console.log("Seeding global_state...");
  await db
    .insert(globalState)
    .values({ id: 1, currentDay: 1, escalationState: "GREEN", mediaPressureIndex: 0, simulationStatus: "not_started", fastModeMultiplier: 1 / 60, respectBlackoutWindow: false })
    .onConflictDoNothing();

  console.log("Seeding teams + shared logins + model_state...");
  const credentials: { region: string; username: string; password: string }[] = [];

  for (const r of regionSeed) {
    const username = r.id.toLowerCase();
    const [team] = await db
      .insert(teams)
      .values({ regionId: r.id, username })
      .onConflictDoNothing()
      .returning();

    const teamId = team ? team.id : (await db.query.teams.findFirst({ where: (t, { eq }) => eq(t.regionId, r.id) }))!.id;

    const password = fixedPasswords[r.id];
    const passwordHash = await bcrypt.hash(password, 10);
    await db
      .insert(users)
      .values({
        username,
        passwordHash,
        name: `${r.id} Team`,
        role: "student",
        teamId,
      })
      .onConflictDoUpdate({ target: users.username, set: { passwordHash } });
    credentials.push({ region: r.id, username, password });

    await db
      .insert(modelState)
      .values({
        regionId: r.id,
        day: 1,
        rt: r.startingRt,
        cfrMultiplier: r.startingCfrMultiplier,
        confirmedCases: r.startingConfirmed,
        estimatedTrueCasesLow: r.startingEstTrueLow,
        estimatedTrueCasesHigh: r.startingEstTrueHigh,
        deaths: r.startingDeaths,
        hospitalCapacityPct: r.startingHospCapacityPct,
        surveillanceIndex: r.startingSurveillanceIndex,
        fundRemaining: r.startingFund,
        ppeDaysRemaining: r.startingPpeDays,
        antiviralsRemaining: r.startingAntivirals,
        hcwSurgePct: r.startingHcwSurgePct,
        politicalTensionIndex: r.startingPoliticalTension,
        publicTrustIndex: r.startingPublicTrust,
        populationHappinessIndex: 60,
      })
      .onConflictDoNothing();

    // Counterfactual "optimal" shadow (see lib/model-engine.ts) starts from
    // the same Day-1 values as the real simulation.
    await db
      .insert(modelStateOptimal)
      .values({
        regionId: r.id,
        rt: r.startingRt,
        cfrMultiplier: r.startingCfrMultiplier,
        confirmedCases: r.startingConfirmed,
        estimatedTrueCasesLow: r.startingEstTrueLow,
        estimatedTrueCasesHigh: r.startingEstTrueHigh,
        deaths: r.startingDeaths,
        publicTrustIndex: r.startingPublicTrust,
        populationHappinessIndex: 60,
      })
      .onConflictDoNothing();
  }

  console.log("Seeding instructor account...");
  const instructorPassword = fixedPasswords.instructor;
  const instructorHash = await bcrypt.hash(instructorPassword, 10);
  await db
    .insert(users)
    .values({
      username: "instructor",
      passwordHash: instructorHash,
      name: "Instructor",
      role: "instructor",
      teamId: null,
    })
    .onConflictDoUpdate({ target: users.username, set: { passwordHash: instructorHash } });

  console.log("\n================ LOGIN CREDENTIALS ================");
  console.log("Instructor:");
  console.log(`  username: instructor`);
  console.log(`  password: ${instructorPassword}`);
  console.log("\nTeams (shared login per region — hand the password to the whole team):");
  for (const c of credentials) {
    console.log(`  ${c.region.padEnd(6)} username: ${c.username.padEnd(8)} password: ${c.password}`);
  }
  console.log("=====================================================\n");
  console.log("These are fixed passwords defined in lib/db/seed-data/credentials.ts — edit that file");
  console.log("and re-run `npm run db:seed` if you want to change them. Re-running this command is");
  console.log("safe any time; it always applies the same credentials from that file.\n");

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
