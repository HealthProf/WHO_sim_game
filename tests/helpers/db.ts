import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { regions, events, eventChainLinks } from "@/lib/db/schema";
import { regionSeed } from "@/lib/db/seed-data/regions";
import { eventSeed } from "@/lib/db/seed-data/events";

// Every per-session table, plus the identity tables tests create fresh rows
// in on every run — everything except the global/static regions, events,
// and eventChainLinks. Kept as one list so a newly added per-session table
// has to be added here too, matching the "one central list" isolation-suite
// pattern from the build plan.
const RESETTABLE_TABLES = [
  "scores",
  "decisions",
  "coordination_messages",
  "global_feed_items",
  "team_notifications",
  "resource_pledges",
  "snap_vote_responses",
  "snap_votes",
  "announcement_acks",
  "announcements",
  "budget_cycle_donations",
  "budget_cycle_responses",
  "budget_cycles",
  "market_requests",
  "region_trade_offers",
  "emergency_funding_contributions",
  "emergency_funding_requests",
  "social_milestone_awards",
  "event_dispatches",
  "model_state_history",
  "instructor_actions",
  "model_state",
  "model_state_optimal",
  "teams",
  "session_region_credentials",
  "session_state",
  "game_sessions",
  "users",
  "rate_limit_counters",
] as const;

export async function resetDb() {
  await db.execute(sql.raw(`TRUNCATE TABLE ${RESETTABLE_TABLES.join(", ")} RESTART IDENTITY CASCADE`));
}

let staticSeeded = false;
export async function seedStaticOnce() {
  if (staticSeeded) return;
  const existing = await db.query.regions.findMany();
  if (existing.length === 0) {
    for (const r of regionSeed) {
      await db.insert(regions).values(r).onConflictDoUpdate({ target: regions.id, set: r });
    }
  }
  const existingEvents = await db.query.events.findMany();
  if (existingEvents.length === 0) {
    for (const e of eventSeed) {
      const { chainPrev, ...eventRow } = e;
      await db.insert(events).values(eventRow).onConflictDoUpdate({ target: events.id, set: eventRow });
    }
    for (const e of eventSeed) {
      for (const prev of e.chainPrev) {
        await db.insert(eventChainLinks).values({ prevEventId: prev, nextEventId: e.id }).onConflictDoNothing();
      }
    }
  }
  staticSeeded = true;
}
