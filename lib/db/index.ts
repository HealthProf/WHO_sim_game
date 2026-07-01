import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleNodePostgres } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL ?? "";
const isNeon = /neon\.tech/.test(databaseUrl);

// Neon in production/Vercel: use the HTTP driver. A raw pg.Pool over TCP
// from serverless functions is a well-known source of connection
// exhaustion (each cold start/invocation can open new connections faster
// than they're released, eventually causing requests to hang with no
// error surfaced anywhere). The HTTP driver is stateless per-query — no
// pool to exhaust.
//
// Local/non-Neon Postgres (e.g. a local dev database): fall back to the
// standard node-postgres driver, since the HTTP driver only speaks to
// Neon's infrastructure.
export const db = isNeon
  ? drizzleNeonHttp(neon(databaseUrl), { schema })
  : drizzleNodePostgres(new Pool({ connectionString: databaseUrl }), { schema });
