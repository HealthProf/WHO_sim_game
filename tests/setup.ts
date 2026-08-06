// Runs before every test file. Points lib/db/index.ts at TEST_DATABASE_URL
// instead of DATABASE_URL, and fails loudly if that's ever a Neon URL — the
// whole point of this test suite is exercising real Postgres locally so
// db.transaction() usage would silently "work" in tests and then explode in
// production against the neon-http driver (see lib/db-atomic.ts).
import "dotenv/config";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error(
    "TEST_DATABASE_URL is not set. Point it at a local Postgres database (never Neon) before running tests."
  );
}
if (/neon\.tech/.test(testUrl)) {
  throw new Error("TEST_DATABASE_URL must not point at Neon — tests run against real Postgres only, never prod.");
}

process.env.DATABASE_URL = testUrl;
