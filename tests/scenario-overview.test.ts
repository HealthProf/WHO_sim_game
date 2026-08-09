import { describe, expect, it, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { sessionState } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resetDb, seedStaticOnce } from "./helpers/db";
import { createTestUser } from "./helpers/session";
import { createSession } from "@/lib/session-lifecycle";
import { SCENARIO_OVERVIEW_SLIDES, SCENARIO_SLIDE_SECONDS, SCENARIO_OVERVIEW_TOTAL_SECONDS } from "@/lib/db/seed-data/scenario-overview-slides";

// Covers Update 3's server-side triggers: createSession() (demo mode starts
// the Scenario Overview deck immediately; instructor mode does not — the
// credential sheet's "Scenario Overview" button and a reset are its
// triggers instead) and the shared-clock design's isolation.
//
// Deliberately does NOT exercise app/api/instructor/scenario-overview or
// app/api/scenario-overview directly: both transitively import lib/auth via
// lib/session-context, and lib/auth pulls in next-auth's "next/server"
// subpath — resolvable at Next.js build/runtime but not under plain Vitest
// (no Next plugin configured here). This is the same constraint documented
// in tests/isolation.test.ts's header comment for scoreDecision(); verified
// empirically while writing this suite (importing the reset route directly
// throws `Cannot find module '.../node_modules/next/server'` from inside
// next-auth's lib/env.js). Those two routes' request-handling logic (token
// resolution, requireInstructorActor gating, landingPath derivation) is
// covered by the manual Playwright pass in the build plan instead.
describe("Scenario Overview slide deck", () => {
  beforeEach(async () => {
    await resetDb();
    await seedStaticOnce();
  });

  it("is data-driven: total seconds derives from the slide count, not a hardcoded number", () => {
    expect(SCENARIO_OVERVIEW_SLIDES.length).toBeGreaterThan(0);
    expect(SCENARIO_OVERVIEW_TOTAL_SECONDS).toBe(SCENARIO_OVERVIEW_SLIDES.length * SCENARIO_SLIDE_SECONDS);
  });

  it("createSession(demo) starts the deck immediately", async () => {
    const owner = await createTestUser("instructor");
    const sessionId = await createSession(owner.id, "demo");

    const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
    expect(gs?.scenarioOverviewStartedAt).not.toBeNull();
    // Started just now, not backdated or in the future.
    const elapsedMs = Date.now() - new Date(gs!.scenarioOverviewStartedAt!).getTime();
    expect(elapsedMs).toBeGreaterThanOrEqual(0);
    expect(elapsedMs).toBeLessThan(5000);
  });

  it("createSession(instructor) leaves the deck unstarted — the credential sheet's button and a reset are its triggers", async () => {
    const owner = await createTestUser("instructor");
    const sessionId = await createSession(owner.id, "instructor");

    const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
    expect(gs?.scenarioOverviewStartedAt).toBeNull();
  });

  it("scenarioOverviewStartedAt is session-isolated: starting the deck in one demo session never appears in another", async () => {
    const ownerA = await createTestUser("instructor");
    const ownerB = await createTestUser("instructor");
    const sessionA = await createSession(ownerA.id, "demo");
    const sessionB = await createSession(ownerB.id, "instructor");

    const gsA = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionA) });
    const gsB = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionB) });
    expect(gsA?.scenarioOverviewStartedAt).not.toBeNull();
    expect(gsB?.scenarioOverviewStartedAt).toBeNull();
  });
});
