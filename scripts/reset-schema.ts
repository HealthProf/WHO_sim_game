import "dotenv/config";
import { db } from "../lib/db";
import { sql } from "drizzle-orm";

// DESTRUCTIVE. Drops the entire public schema and recreates it empty, so a
// following `drizzle-kit push` builds every table from scratch.
//
// Needed when the live schema has diverged far enough that push's diff turns
// ambiguous — it can't tell a renamed table from a dropped-plus-created one,
// so it tries to prompt, and under CI (no TTY) that prompt fails and push
// silently applies nothing. Against an empty schema there is nothing to
// disambiguate, so the push is deterministic.
//
// Everything in the database is lost: all accounts, all game sessions, all
// per-session state. Only the global static content (regions, events) comes
// back, via `npm run db:seed`. That's an acceptable trade for this project's
// non-production data, but it is never something to run casually — the
// workflow gates it behind an explicit opt-in input.
async function main() {
  if (process.env.CONFIRM_DESTRUCTIVE_RESET !== "yes") {
    console.error(
      "Refusing to run: set CONFIRM_DESTRUCTIVE_RESET=yes to confirm dropping every table."
    );
    process.exit(1);
  }

  console.log("Dropping public schema (all tables and data)...");
  await db.execute(sql`drop schema public cascade`);
  await db.execute(sql`create schema public`);
  console.log("Public schema recreated empty. Run drizzle-kit push next.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
