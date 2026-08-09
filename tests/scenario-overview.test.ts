import { describe, expect, it, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { sessionState } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { resetDb, seedStaticOnce } from "./helpers/db";
import { createTestUser } from "./helpers/session";
import { createSession } from "@/lib/session-lifecycle";
import {
  SCENARIO_OVERVIEW_SLIDES,
  SCENARIO_SLIDE_SECONDS,
  SCENARIO_OVERVIEW_SLIDE_STARTS,
  SCENARIO_OVERVIEW_TOTAL_SECONDS,
} from "@/lib/db/seed-data/scenario-overview-slides";
import { SCENARIO_OVERVIEW_PREROLL_SECONDS } from "@/lib/config";
import { computeCurrentSlideIndex } from "@/lib/use-scenario-overview";

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

  it("is data-driven: total seconds is the sum of each slide's own duration, not a hardcoded number", () => {
    expect(SCENARIO_OVERVIEW_SLIDES.length).toBeGreaterThan(0);
    const expectedTotal = SCENARIO_OVERVIEW_SLIDES.reduce((sum, s) => sum + (s.seconds ?? SCENARIO_SLIDE_SECONDS), 0);
    expect(SCENARIO_OVERVIEW_TOTAL_SECONDS).toBe(expectedTotal);
  });

  // The closing slide ("Let's begin.") is intentionally shorter than the
  // rest — this is the per-slide-duration lookup's whole reason to exist
  // (see lib/use-scenario-overview.ts), so pin its exact shape rather than
  // just checking the total.
  it("the final slide has a shorter duration than the default, reflected in the precomputed offsets", () => {
    const lastIndex = SCENARIO_OVERVIEW_SLIDES.length - 1;
    const lastSlide = SCENARIO_OVERVIEW_SLIDES[lastIndex];
    expect(lastSlide.seconds).toBeDefined();
    expect(lastSlide.seconds!).toBeLessThan(SCENARIO_SLIDE_SECONDS);

    // Every earlier slide uses the default duration, so the last slide's
    // start offset should land exactly at (n-1) * SCENARIO_SLIDE_SECONDS.
    expect(SCENARIO_OVERVIEW_SLIDE_STARTS[lastIndex]).toBe(lastIndex * SCENARIO_SLIDE_SECONDS);
    expect(SCENARIO_OVERVIEW_TOTAL_SECONDS).toBe(SCENARIO_OVERVIEW_SLIDE_STARTS[lastIndex] + lastSlide.seconds!);
  });

  it("createSession(demo) starts the deck a few seconds in the future (pre-roll buffer)", async () => {
    const owner = await createTestUser("instructor");
    const beforeCall = Date.now();
    const sessionId = await createSession(owner.id, "demo");

    const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
    expect(gs?.scenarioOverviewStartedAt).not.toBeNull();
    // Set to "now + preroll", not bare "now" — see SCENARIO_OVERVIEW_PREROLL_SECONDS's
    // comment in lib/config.ts for why: without this buffer, the client
    // discovering the deck (page load, first poll) ate directly into slide
    // 1's on-screen time.
    const offsetMs = new Date(gs!.scenarioOverviewStartedAt!).getTime() - beforeCall;
    expect(offsetMs).toBeGreaterThanOrEqual(SCENARIO_OVERVIEW_PREROLL_SECONDS * 1000 - 500);
    expect(offsetMs).toBeLessThanOrEqual(SCENARIO_OVERVIEW_PREROLL_SECONDS * 1000 + 5000);
  });

  it("createSession(instructor) leaves the deck unstarted — the credential sheet's button and a reset are its triggers", async () => {
    const owner = await createTestUser("instructor");
    const sessionId = await createSession(owner.id, "instructor");

    const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
    expect(gs?.scenarioOverviewStartedAt).toBeNull();
  });

  // The core of the pacing bug fix: per-slide-duration lookup and the
  // pre-roll clamp, exercised directly against real elapsed-time values
  // rather than through a live 1-second interval.
  describe("computeCurrentSlideIndex", () => {
    it("clamps to slide 0 (not null) while still inside the pre-roll window", () => {
      expect(computeCurrentSlideIndex(-3)).toBe(0);
      expect(computeCurrentSlideIndex(-0.1)).toBe(0);
    });

    it("gives every slide except the last its full SCENARIO_SLIDE_SECONDS window", () => {
      // Slide 0: [0, 10). Slide 1: [10, 20). Etc.
      expect(computeCurrentSlideIndex(0)).toBe(0);
      expect(computeCurrentSlideIndex(9.9)).toBe(0);
      expect(computeCurrentSlideIndex(10)).toBe(1);
      expect(computeCurrentSlideIndex(19.9)).toBe(1);
      expect(computeCurrentSlideIndex(20)).toBe(2);
    });

    it("the final slide gets its own shorter window, then the deck ends", () => {
      const lastIndex = SCENARIO_OVERVIEW_SLIDES.length - 1;
      const lastStart = SCENARIO_OVERVIEW_SLIDE_STARTS[lastIndex];
      expect(computeCurrentSlideIndex(lastStart)).toBe(lastIndex);
      expect(computeCurrentSlideIndex(SCENARIO_OVERVIEW_TOTAL_SECONDS - 0.1)).toBe(lastIndex);
      expect(computeCurrentSlideIndex(SCENARIO_OVERVIEW_TOTAL_SECONDS)).toBeNull();
      expect(computeCurrentSlideIndex(SCENARIO_OVERVIEW_TOTAL_SECONDS + 100)).toBeNull();
    });
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
