import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    // Sequential: these tests hit a real shared local Postgres and several
    // (concurrency tests especially) depend on precise row-level races, so
    // parallel test files would fight each other over the same connection
    // pool and truncated tables.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
