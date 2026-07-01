import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../lib/db";
import {
  regions,
  teams,
  users,
  modelState,
  globalState,
  events,
  eventChainLinks,
} from "../lib/db/schema";
import { regionSeed } from "../lib/db/seed-data/regions";
import { eventSeed } from "../lib/db/seed-data/events";

function randomPassword(): string {
  const words = ["horizon", "vector", "compass", "delta", "tundra", "harbor", "sierra", "cobalt"];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(100 + Math.random() * 900);
  return `${w}${n}`;
}

async function main() {
  console.log("Seeding regions...");
  for (const r of regionSeed) {
    await db.insert(regions).values(r).onConflictDoNothing();
  }

  console.log("Seeding events...");
  for (const e of eventSeed) {
    const { chainPrev, ...eventRow } = e;
    await db.insert(events).values(eventRow).onConflictDoNothing();
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
  const credentials: { region: string; email: string; password: string }[] = [];

  for (const r of regionSeed) {
    const email = `${r.id.toLowerCase()}@sim.local`;
    const [team] = await db
      .insert(teams)
      .values({ regionId: r.id, loginEmail: email })
      .onConflictDoNothing()
      .returning();

    const teamId = team ? team.id : (await db.query.teams.findFirst({ where: (t, { eq }) => eq(t.regionId, r.id) }))!.id;

    const password = randomPassword();
    const passwordHash = await bcrypt.hash(password, 10);
    await db
      .insert(users)
      .values({
        email,
        passwordHash,
        name: `${r.id} Team`,
        role: "student",
        teamId,
      })
      .onConflictDoUpdate({ target: users.email, set: { passwordHash } });
    credentials.push({ region: r.id, email, password });

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
      })
      .onConflictDoNothing();
  }

  console.log("Seeding instructor account...");
  const instructorPassword = randomPassword();
  const instructorHash = await bcrypt.hash(instructorPassword, 10);
  await db
    .insert(users)
    .values({
      email: "instructor@sim.local",
      passwordHash: instructorHash,
      name: "Instructor",
      role: "instructor",
      teamId: null,
    })
    .onConflictDoUpdate({ target: users.email, set: { passwordHash: instructorHash } });

  console.log("\n================ LOGIN CREDENTIALS ================");
  console.log("Instructor:");
  console.log(`  email: instructor@sim.local`);
  console.log(`  password: ${instructorPassword}`);
  console.log("\nTeams (shared login per region — hand the password to the whole team):");
  for (const c of credentials) {
    console.log(`  ${c.region.padEnd(6)} email: ${c.email.padEnd(20)} password: ${c.password}`);
  }
  console.log("=====================================================\n");
  console.log("Save this output now — passwords are hashed in the database and cannot be recovered later.");
  console.log("Re-run `npm run db:seed` any time to reset all data and generate new passwords.\n");

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
