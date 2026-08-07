import "dotenv/config";
import { db } from "../lib/db";
import * as schema from "../lib/db/schema";
import { sql, getTableName, isTable, type Table } from "drizzle-orm";

// Asserts every table declared in lib/db/schema.ts actually exists in the
// database DATABASE_URL points at, and exits non-zero if any are missing.
//
// This exists because `drizzle-kit push` can fail without failing: when the
// diff is ambiguous (a table in the DB that isn't in the schema, alongside a
// new table in the schema, which it can't tell apart from a rename) it tries
// to open an interactive prompt. Under CI there's no TTY, so it prints
// "Interactive prompts require a TTY terminal" and then exits 0 — a green
// step that applied nothing. Production then serves 500s on the first query
// against a missing table, which is exactly how this was found.
//
// Run this after any push so the failure is loud and immediate, at the point
// the migration ran, rather than silent until a user hits the app.
async function main() {
  // schema.ts exports enums alongside tables; isTable narrows to just tables.
  const expected = (Object.values(schema) as unknown[])
    .filter((v): v is Table => isTable(v))
    .map((t) => getTableName(t))
    .sort();

  const rows = await db.execute<{ table_name: string }>(
    sql`select table_name from information_schema.tables where table_schema = 'public'`
  );
  // The two drivers disagree on result shape: neon-http returns { rows },
  // node-postgres returns the array directly (see lib/db/index.ts).
  const present = new Set(
    (Array.isArray(rows) ? rows : rows.rows).map((r) => r.table_name)
  );

  const missing = expected.filter((t) => !present.has(t));

  if (missing.length > 0) {
    console.error(
      `\nSchema verification FAILED — ${missing.length} of ${expected.length} expected tables are missing:\n`
    );
    for (const t of missing) console.error(`  - ${t}`);
    console.error(
      "\nThe push did not apply. If drizzle-kit logged an interactive-prompt/TTY\n" +
        "error above, its diff was ambiguous and it silently applied nothing. Re-run\n" +
        "this workflow with the `reset` input checked to drop the diverged schema and\n" +
        "recreate it from scratch (destructive — see the workflow description).\n"
    );
    process.exit(1);
  }

  console.log(`Schema verified: all ${expected.length} tables present.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
