import "dotenv/config";
import { db } from "../lib/db";
import { regions, events, eventChainLinks } from "../lib/db/schema";
import { regionSeed } from "../lib/db/seed-data/regions";
import { eventSeed } from "../lib/db/seed-data/events";

// Seeds only the global, static reference content — regions and events are
// shared across every game session and never wiped by a reset or session
// deletion. Teams, model state, session state, and login credentials are all
// per-session now (see lib/session-lifecycle.ts createSession) and are
// created through the app when a session is created, not by this script.
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

  console.log("\nStatic content seeded: regions and events.");
  console.log("Accounts and game sessions are created through the app UI — there are no more");
  console.log("fixed logins. Register an account, then create an instructor or demo session.\n");

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
