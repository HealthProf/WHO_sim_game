import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Update 2: app/(public)/license/page.tsx reads LICENSE.md from disk at
  // request time (process.cwd()) so the in-app copy can never drift from the
  // repo file. Without this, Vercel's file tracer has no way to know that
  // route depends on a file outside app/ and won't ship LICENSE.md into the
  // lambda — the page works locally and 500s in production.
  outputFileTracingIncludes: {
    "/license": ["./LICENSE.md"],
  },
};

export default nextConfig;
