import { describe, expect, it, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { sessionState, modelState, cheatCodeAttempts, cheatRegionEffects, announcements, globalFeedItems } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { resetDb, seedStaticOnce } from "./helpers/db";
import { createTestSession, actorFor, instructorActorFor } from "./helpers/session";
import {
  handleCheatAttempt,
  executeCheatCode,
  resolveCheatMonologue,
  computeRevertOverride,
} from "@/lib/cheat-engine";
import { tokenize, matchCheatCode, ARROW_GLYPHS, MONOLOGUE_MESSAGES, MONOLOGUE_MESSAGE_SECONDS } from "@/lib/cheat-codes";

describe("cheat code tokenizing + matching", () => {
  it("treats arrow keys as single tokens and is case-insensitive", () => {
    const raw = `${ARROW_GLYPHS.UP}${ARROW_GLYPHS.UP}${ARROW_GLYPHS.DOWN}${ARROW_GLYPHS.DOWN}${ARROW_GLYPHS.LEFT}${ARROW_GLYPHS.RIGHT}${ARROW_GLYPHS.LEFT}${ARROW_GLYPHS.RIGHT}ba`;
    const code = matchCheatCode(tokenize(raw));
    expect(code?.key).toBe("FUNDS_30M");
  });

  it("matches phrase codes regardless of case or spacing", () => {
    expect(matchCheatCode(tokenize("do A barrel ROLL"))?.key).toBe("BARREL_ROLL");
    expect(matchCheatCode(tokenize("iddqd"))?.key).toBe("GOD_MODE");
    expect(matchCheatCode(tokenize("abacabb"))?.key).toBe("FLIP_COUNTS");
    expect(matchCheatCode(tokenize("one shot to rule them all"))?.key).toBe("MONOLOGUE");
  });

  it("does not match garbage input", () => {
    expect(matchCheatCode(tokenize("hello world"))).toBeNull();
    expect(matchCheatCode(tokenize(""))).toBeNull();
  });
});

describe("cheat code engine", () => {
  beforeEach(async () => {
    await resetDb();
    await seedStaticOnce();
  });

  it("region-scoped codes are rejected (as a plain fail, not an error) for an instructor actor", async () => {
    const { sessionId, ownerUserId } = await createTestSession("instructor");
    const instructor = await instructorActorFor(sessionId, ownerUserId);

    const raw = `${ARROW_GLYPHS.UP}${ARROW_GLYPHS.UP}${ARROW_GLYPHS.DOWN}${ARROW_GLYPHS.DOWN}${ARROW_GLYPHS.LEFT}${ARROW_GLYPHS.RIGHT}${ARROW_GLYPHS.LEFT}${ARROW_GLYPHS.RIGHT}ba`;
    const result = await handleCheatAttempt(sessionId, instructor, raw);
    expect(result.result).toBe("fail");
  });

  it("FUNDS_30M credits the entering region's fund exactly once, even if executed twice", async () => {
    const { sessionId } = await createTestSession("instructor");
    const afro = await actorFor(sessionId, "AFRO");
    const before = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, "AFRO")) });

    const raw = `${ARROW_GLYPHS.UP}${ARROW_GLYPHS.UP}${ARROW_GLYPHS.DOWN}${ARROW_GLYPHS.DOWN}${ARROW_GLYPHS.LEFT}${ARROW_GLYPHS.RIGHT}${ARROW_GLYPHS.LEFT}${ARROW_GLYPHS.RIGHT}ba`;
    const attempt = await handleCheatAttempt(sessionId, afro, raw);
    expect(attempt.result).toBe("success");
    expect(attempt.codeKey).toBe("FUNDS_30M");

    await executeCheatCode(sessionId, afro, "FUNDS_30M");
    await executeCheatCode(sessionId, afro, "FUNDS_30M"); // simulate a duplicate/replayed execute call

    const after = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, "AFRO")) });
    expect(after!.fundRemaining).toBe(before!.fundRemaining + 30_000_000);
  });

  it("FUNDS_30M only credits the entering region, never other regions in the same session", async () => {
    const { sessionId } = await createTestSession("instructor");
    const afro = await actorFor(sessionId, "AFRO");
    const beforeAmro = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, "AMRO")) });

    await executeCheatCode(sessionId, afro, "FUNDS_30M");

    const afterAmro = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, "AMRO")) });
    expect(afterAmro!.fundRemaining).toBe(beforeAmro!.fundRemaining);
  });

  it("GOD_MODE sets the intensity multiplier to 5x, bypassing the tempo dial's normal clamp", async () => {
    const { sessionId, ownerUserId } = await createTestSession("instructor");
    const instructor = await instructorActorFor(sessionId, ownerUserId);

    const attempt = await handleCheatAttempt(sessionId, instructor, "IDDQD");
    expect(attempt.result).toBe("success");
    await executeCheatCode(sessionId, instructor, "GOD_MODE");

    const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
    expect(gs!.intensityMultiplier).toBe(5);
  });

  it("FLIP_COUNTS swaps deaths and confirmedCases for the entering region only", async () => {
    const { sessionId } = await createTestSession("instructor");
    const afro = await actorFor(sessionId, "AFRO");
    await db
      .update(modelState)
      .set({ confirmedCases: 1000, deaths: 40 })
      .where(and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, "AFRO")));

    await executeCheatCode(sessionId, afro, "FLIP_COUNTS");

    const after = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, "AFRO")) });
    expect(after!.confirmedCases).toBe(40);
    expect(after!.deaths).toBe(1000);
  });

  it("five failed attempts do not trigger the warning, but a sixth does — identifying the offending region", async () => {
    const { sessionId } = await createTestSession("instructor");
    const afro = await actorFor(sessionId, "AFRO");

    for (let i = 0; i < 5; i++) {
      const r = await handleCheatAttempt(sessionId, afro, "not a real code");
      expect(r.result).toBe("fail");
    }
    let feed = await db.query.globalFeedItems.findMany({ where: eq(globalFeedItems.sessionId, sessionId) });
    expect(feed.length).toBe(0);

    await handleCheatAttempt(sessionId, afro, "still not a real code");

    feed = await db.query.globalFeedItems.findMany({ where: eq(globalFeedItems.sessionId, sessionId) });
    expect(feed.length).toBe(1);
    expect(feed[0].headlineText).toContain("AFRO");

    const globalAnnouncement = await db.query.announcements.findFirst({
      where: and(eq(announcements.sessionId, sessionId), eq(announcements.scope, "global_display")),
    });
    expect(globalAnnouncement?.message).toContain("AFRO");

    // Resets after firing — the very next failure alone shouldn't refire it.
    await handleCheatAttempt(sessionId, afro, "nope");
    feed = await db.query.globalFeedItems.findMany({ where: eq(globalFeedItems.sessionId, sessionId) });
    expect(feed.length).toBe(1);
  });

  it("a correct entry resets an actor's fail streak", async () => {
    const { sessionId } = await createTestSession("instructor");
    const afro = await actorFor(sessionId, "AFRO");

    for (let i = 0; i < 4; i++) await handleCheatAttempt(sessionId, afro, "wrong");
    await handleCheatAttempt(sessionId, afro, "IDDQD"); // global code, applicable to any actor

    const row = await db.query.cheatCodeAttempts.findFirst({ where: and(eq(cheatCodeAttempts.sessionId, sessionId), eq(cheatCodeAttempts.actorKey, "AFRO")) });
    expect(row?.failCount).toBe(0);
  });

  it("fail counters and redemptions are session-isolated", async () => {
    const a = await createTestSession("instructor");
    const b = await createTestSession("instructor");
    const afroA = await actorFor(a.sessionId, "AFRO");

    for (let i = 0; i < 6; i++) await handleCheatAttempt(a.sessionId, afroA, "wrong");

    const feedA = await db.query.globalFeedItems.findMany({ where: eq(globalFeedItems.sessionId, a.sessionId) });
    const feedB = await db.query.globalFeedItems.findMany({ where: eq(globalFeedItems.sessionId, b.sessionId) });
    expect(feedA.length).toBe(1);
    expect(feedB.length).toBe(0);

    await executeCheatCode(a.sessionId, afroA, "FUNDS_30M");
    const modelB = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, b.sessionId), eq(modelState.regionId, "AFRO")) });
    const seedFund = (await db.query.regions.findFirst({ where: (t, { eq: e }) => e(t.id, "AFRO") }))!.startingFund;
    expect(modelB!.fundRemaining).toBe(seedFund);
  });

  it("MONOLOGUE pauses the session instantly and resolveCheatMonologue resumes it once the sequence has elapsed", async () => {
    const { sessionId, ownerUserId } = await createTestSession("instructor");
    const instructor = await instructorActorFor(sessionId, ownerUserId);
    await db.update(sessionState).set({ simulationStatus: "running", simulationStartedAt: new Date() }).where(eq(sessionState.sessionId, sessionId));

    const attempt = await handleCheatAttempt(sessionId, instructor, "one shot to rule them all");
    expect(attempt.result).toBe("success");
    expect(attempt.noDisplay).toBe(true);

    const pausedGs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
    expect(pausedGs!.simulationStatus).toBe("paused");

    // Fast-forward: resolveCheatMonologue only acts once the full message
    // sequence has elapsed, so back-date monologueStartedAt instead of
    // waiting for it in real time. Derived from the actual constants rather
    // than a hardcoded number so this test doesn't silently under-shoot if
    // MONOLOGUE_MESSAGE_SECONDS or the message count is ever retuned.
    const { cheatCodeState } = await import("@/lib/db/schema");
    const totalMonologueMs = MONOLOGUE_MESSAGES.length * MONOLOGUE_MESSAGE_SECONDS * 1000;
    await db
      .update(cheatCodeState)
      .set({ monologueStartedAt: new Date(Date.now() - totalMonologueMs - 5_000) })
      .where(eq(cheatCodeState.sessionId, sessionId));

    await resolveCheatMonologue(sessionId);

    const resumedGs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
    expect(resumedGs!.simulationStatus).toBe("running");
  });

  it("computeRevertOverride tapers linearly toward zero and holds at zero once revealed", () => {
    const start = { revertActive: true, revertPhase: "counting_down", revertStartedAt: new Date(0), revertStartConfirmed: 1000, revertStartDeaths: 100 };
    const gameDaysPerRealMinute = 1; // 1 game day per real minute, for round numbers

    // Halfway through the 14-day taper (7 game days = 7 real minutes = 420,000ms).
    const halfway = computeRevertOverride(start, gameDaysPerRealMinute, 420_000);
    expect(halfway).toEqual({ confirmedCases: 500, deaths: 50 });

    const notActive = computeRevertOverride({ ...start, revertActive: false }, gameDaysPerRealMinute, 420_000);
    expect(notActive).toBeNull();

    const revealed = computeRevertOverride({ ...start, revertPhase: "revealed_winner" }, gameDaysPerRealMinute, 420_000);
    expect(revealed).toEqual({ confirmedCases: 0, deaths: 0 });
  });

  it("REVERT_TO_ZERO creates a per-region row seeded from that region's current real counts", async () => {
    const { sessionId } = await createTestSession("instructor");
    const afro = await actorFor(sessionId, "AFRO");
    await db
      .update(modelState)
      .set({ confirmedCases: 2000, deaths: 80 })
      .where(and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, "AFRO")));

    await executeCheatCode(sessionId, afro, "REVERT_TO_ZERO");

    const row = await db.query.cheatRegionEffects.findFirst({ where: and(eq(cheatRegionEffects.sessionId, sessionId), eq(cheatRegionEffects.regionId, "AFRO")) });
    expect(row?.revertActive).toBe(true);
    expect(row?.revertStartConfirmed).toBe(2000);
    expect(row?.revertStartDeaths).toBe(80);

    // The real, underlying model_state row is untouched — only the display
    // layer (app/api/dashboard, app/api/display) overrides what's shown.
    const real = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, "AFRO")) });
    expect(real!.confirmedCases).toBe(2000);
    expect(real!.deaths).toBe(80);
  });
});
