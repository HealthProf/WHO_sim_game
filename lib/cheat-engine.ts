// Server-side effect application for the easter-egg cheat codes — see
// lib/cheat-codes.ts for the code definitions/matching and
// components/cheat-code-widget.tsx for the entry UI. Split into three
// pieces: (1) attempt handling (matching + the 5-strikes fail counter), (2)
// immediate/delayed effect application, (3) tick-driven resolution for the
// two effects that unfold over time (the monologue's game-wide pause and
// the region revert's 14-day taper) — the tick pieces are called from
// lib/deadline.ts processDeadlines, same as every other "happens
// automatically while the sim is running" mechanic (see AGENTS.md).
import { db } from "./db";
import {
  sessionState,
  modelState,
  teams,
  teamNotifications,
  announcements,
  globalFeedItems,
  cheatCodeAttempts,
  cheatCodeRedemptions,
  cheatCodeState,
  cheatRegionEffects,
} from "./db/schema";
import { and, eq, sql } from "drizzle-orm";
import { creditRegionField } from "./db-atomic";
import { bumpStateVersion } from "./state-version";
import { ANNOUNCEMENT_AUTO_DISMISS_SECONDS } from "./config";
import type { Actor } from "./session-context";
import {
  CHEAT_CODES,
  CHEAT_FAIL_WARNING_THRESHOLD,
  CHEAT_REVERT_DURATION_GAME_DAYS,
  CHEAT_WINNER_REVEAL_PAUSE_SECONDS,
  MONOLOGUE_MESSAGES,
  MONOLOGUE_MESSAGE_SECONDS,
  cheatCodeApplies,
  matchCheatCode,
  tokenize,
  type CheatCodeKey,
} from "./cheat-codes";

function actorKeyFor(actor: Actor): string {
  return actor.role === "instructor" ? "instructor" : actor.regionId ?? "instructor";
}

// Posts to every surface a "regular" global announcement already reaches
// (see lib/announcements.ts's announceDispatch, which this mirrors): a
// transient banner for the projector, a persistent modal for every team's
// dashboard, a ticker line, and a dashboard "recent developments" entry —
// plus the instructor console, which polls the same activeGlobalAnnouncement
// field via /api/dashboard (see app/api/dashboard/route.ts).
async function broadcastGlobalMessage(sessionId: string, title: string, message: string): Promise<void> {
  const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });
  await db.insert(announcements).values({
    sessionId,
    scope: "global_display",
    kind: "cheat_code",
    targetTeamIds: null,
    title,
    message,
    autoDismissSeconds: ANNOUNCEMENT_AUTO_DISMISS_SECONDS,
  });
  await db.insert(announcements).values({
    sessionId,
    scope: "team",
    kind: "cheat_code",
    targetTeamIds: null,
    title,
    message,
    autoDismissSeconds: null,
  });
  if (allTeams.length > 0) {
    await db.insert(teamNotifications).values(allTeams.map((t) => ({ sessionId, teamId: t.id, kind: "cheat_code", message: `${title}: ${message}` })));
  }
  await db.insert(globalFeedItems).values({ sessionId, headlineText: `${title}: ${message}` });
  await bumpStateVersion(sessionId);
}

// --- Attempt handling: matching + the 5-strikes fail counter ---

async function recordCheatAttempt(sessionId: string, actor: Actor, success: boolean): Promise<void> {
  const actorKey = actorKeyFor(actor);
  if (success) {
    await db
      .insert(cheatCodeAttempts)
      .values({ sessionId, actorKey, failCount: 0 })
      .onConflictDoUpdate({
        target: [cheatCodeAttempts.sessionId, cheatCodeAttempts.actorKey],
        set: { failCount: 0, updatedAt: new Date() },
      });
    return;
  }

  const [row] = await db
    .insert(cheatCodeAttempts)
    .values({ sessionId, actorKey, failCount: 1 })
    .onConflictDoUpdate({
      target: [cheatCodeAttempts.sessionId, cheatCodeAttempts.actorKey],
      set: { failCount: sql`${cheatCodeAttempts.failCount} + 1`, updatedAt: new Date() },
    })
    .returning();

  if (row && row.failCount > CHEAT_FAIL_WARNING_THRESHOLD) {
    const label = actor.role === "instructor" ? "The instructor" : `The ${actor.regionId} team`;
    await broadcastGlobalMessage(sessionId, "Suspicious Activity", `${label} appears to be trying to enter cheat codes.`);
    // Reset rather than leaving it above threshold, so this fires again
    // every additional 5 failures instead of on every single one from here on.
    await db
      .update(cheatCodeAttempts)
      .set({ failCount: 0, updatedAt: new Date() })
      .where(and(eq(cheatCodeAttempts.sessionId, sessionId), eq(cheatCodeAttempts.actorKey, actorKey)));
  }
}

export interface CheatAttemptResult {
  result: "success" | "fail";
  codeKey?: CheatCodeKey;
  description?: string;
  noDisplay?: boolean;
}

// Called from POST /api/cheat/attempt. Matching + fail-counter bookkeeping
// happens here; the actual game-state mutation for every code except
// MONOLOGUE is deferred to executeCheatCode(), called by the client after
// its own 5s success-screen countdown (see the task spec: "code should
// execute 5 seconds after this screen appears"). MONOLOGUE is the one
// exception — it never shows a success screen, so it applies instantly.
export async function handleCheatAttempt(sessionId: string, actor: Actor, raw: string): Promise<CheatAttemptResult> {
  const tokens = tokenize(raw);
  const code = matchCheatCode(tokens);
  const applicable = code && cheatCodeApplies(code, actor.role);

  if (!code || !applicable) {
    await recordCheatAttempt(sessionId, actor, false);
    return { result: "fail" };
  }

  await recordCheatAttempt(sessionId, actor, true);

  if (code.instant) {
    await applyMonologueInstant(sessionId);
    return { result: "success", codeKey: code.key, noDisplay: true };
  }
  return { result: "success", codeKey: code.key, description: code.description };
}

// Called from POST /api/cheat/execute, after the client's 5s countdown.
// Re-validates applicability server-side (never trusts the client's earlier
// /attempt result alone) rather than assuming the codeKey it was handed is
// legitimate.
export async function executeCheatCode(sessionId: string, actor: Actor, codeKey: CheatCodeKey): Promise<void> {
  const code = CHEAT_CODES.find((c) => c.key === codeKey);
  if (!code || code.instant) return;
  if (!cheatCodeApplies(code, actor.role)) return;

  switch (code.key) {
    case "FUNDS_30M":
      await applyFunds30M(sessionId, actor);
      break;
    case "GOD_MODE":
      await applyGodMode(sessionId);
      break;
    case "BARREL_ROLL":
      await applyBarrelRoll(sessionId);
      break;
    case "FLIP_COUNTS":
      await applyFlipCounts(sessionId, actor);
      break;
    case "REVERT_TO_ZERO":
      await applyRevertToZero(sessionId, actor);
      break;
  }
}

// --- Individual effects ---

async function applyFunds30M(sessionId: string, actor: Actor): Promise<void> {
  if (actor.role !== "student" || !actor.regionId) return;
  const actorKey = actor.regionId;
  const [inserted] = await db
    .insert(cheatCodeRedemptions)
    .values({ sessionId, code: "FUNDS_30M", actorKey, regionId: actor.regionId })
    .onConflictDoNothing()
    .returning();
  if (!inserted) return; // already claimed once this session — no second payout

  await creditRegionField(sessionId, actor.regionId, "fundRemaining", 30_000_000);
  await broadcastGlobalMessage(sessionId, "Emergency Funding", `${actor.regionId} has received a one-time $30,000,000 emergency cheat infusion.`);
}

async function applyGodMode(sessionId: string): Promise<void> {
  await db.update(sessionState).set({ intensityMultiplier: 5, updatedAt: new Date() }).where(eq(sessionState.sessionId, sessionId));
  await db
    .insert(cheatCodeState)
    .values({ sessionId, godModeActive: true })
    .onConflictDoUpdate({ target: cheatCodeState.sessionId, set: { godModeActive: true, updatedAt: new Date() } });
  await bumpStateVersion(sessionId);
  await broadcastGlobalMessage(sessionId, "God Mode Activated", "The difficulty multiplier has been set to 5x.");
}

async function applyBarrelRoll(sessionId: string): Promise<void> {
  const now = new Date();
  await db
    .insert(cheatCodeState)
    .values({ sessionId, barrelRollAt: now })
    .onConflictDoUpdate({ target: cheatCodeState.sessionId, set: { barrelRollAt: now, updatedAt: now } });
  await bumpStateVersion(sessionId);
}

async function applyFlipCounts(sessionId: string, actor: Actor): Promise<void> {
  if (actor.role !== "student" || !actor.regionId) return;
  // Single atomic UPDATE — both SET expressions read the pre-update row, so
  // this is a genuine swap, not a read-then-write race.
  await db
    .update(modelState)
    .set({ confirmedCases: sql`${modelState.deaths}`, deaths: sql`${modelState.confirmedCases}`, updatedAt: new Date() })
    .where(and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, actor.regionId)));
  await bumpStateVersion(sessionId);
}

async function applyRevertToZero(sessionId: string, actor: Actor): Promise<void> {
  if (actor.role !== "student" || !actor.regionId) return;
  const current = await db.query.modelState.findFirst({
    where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, actor.regionId)),
  });
  if (!current) return;

  const now = new Date();
  await db
    .insert(cheatRegionEffects)
    .values({
      sessionId,
      regionId: actor.regionId,
      revertActive: true,
      revertStartedAt: now,
      revertStartConfirmed: current.confirmedCases,
      revertStartDeaths: current.deaths,
      revertPhase: "counting_down",
      revertPhaseAt: null,
    })
    .onConflictDoUpdate({
      target: [cheatRegionEffects.sessionId, cheatRegionEffects.regionId],
      set: {
        revertActive: true,
        revertStartedAt: now,
        revertStartConfirmed: current.confirmedCases,
        revertStartDeaths: current.deaths,
        revertPhase: "counting_down",
        revertPhaseAt: null,
      },
    });
  await bumpStateVersion(sessionId);
}

// MONOLOGUE pauses the whole simulation the instant it's matched (no
// success screen — see the task spec) and resumes it automatically once
// resolveCheatMonologue (below) sees the scripted message sequence has
// finished.
async function applyMonologueInstant(sessionId: string): Promise<void> {
  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  if (!gs) return;
  const now = new Date();

  await db
    .update(sessionState)
    .set({
      simulationStatus: "paused",
      // Don't move the freeze point if the sim was already paused —
      // pausedAt should reflect when the *original* pause began.
      pausedAt: gs.pausedAt ?? now,
      updatedAt: now,
    })
    .where(eq(sessionState.sessionId, sessionId));

  await db
    .insert(cheatCodeState)
    .values({ sessionId, monologueActive: true, monologueStartedAt: now, monologuePrevStatus: gs.simulationStatus })
    .onConflictDoUpdate({
      target: cheatCodeState.sessionId,
      set: { monologueActive: true, monologueStartedAt: now, monologuePrevStatus: gs.simulationStatus, updatedAt: now },
    });
  await bumpStateVersion(sessionId);
}

// --- Tick-driven resolution (called from lib/deadline.ts processDeadlines) ---

// Must run even while the session is "paused" (the monologue's own doing),
// so this is called before processDeadlines' running-status gate rather
// than after it.
export async function resolveCheatMonologue(sessionId: string): Promise<void> {
  const state = await db.query.cheatCodeState.findFirst({ where: eq(cheatCodeState.sessionId, sessionId) });
  if (!state || !state.monologueActive || !state.monologueStartedAt) return;

  const elapsedMs = Date.now() - new Date(state.monologueStartedAt).getTime();
  const totalMs = MONOLOGUE_MESSAGES.length * MONOLOGUE_MESSAGE_SECONDS * 1000;
  if (elapsedMs < totalMs) return;

  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  const now = new Date();
  const prevStatus = state.monologuePrevStatus ?? "running";

  if (gs) {
    const resuming = prevStatus === "running";
    // Fold the time spent frozen for the monologue into pausedAccumulatedMs,
    // same bookkeeping a manual pause/resume does (lib/sim-clock.ts), so the
    // narrative-day clock doesn't jump forward by the monologue's duration.
    // If the sim was already paused before the monologue started, leave
    // everything untouched — that pause is still in effect.
    const pausedDurationMs = resuming && gs.pausedAt ? now.getTime() - new Date(gs.pausedAt).getTime() : 0;
    await db
      .update(sessionState)
      .set({
        simulationStatus: prevStatus,
        pausedAt: resuming ? null : gs.pausedAt,
        pausedAccumulatedMs: resuming ? gs.pausedAccumulatedMs + pausedDurationMs : gs.pausedAccumulatedMs,
        updatedAt: now,
      })
      .where(eq(sessionState.sessionId, sessionId));
  }

  await db
    .update(cheatCodeState)
    .set({ monologueActive: false, monologueStartedAt: null, monologuePrevStatus: null, updatedAt: now })
    .where(eq(cheatCodeState.sessionId, sessionId));
  await bumpStateVersion(sessionId);
}

// Advances the region-revert taper's phase machine: counting_down (14
// game-days tapering toward zero) -> revealed_winner (holds at zero for a
// 5s "you won" beat, announced globally) -> cleared entirely, announcing
// "Just Kidding!" and letting the real, untouched model_state numbers show
// again. Only needs to run while the sim is actually running (unlike the
// monologue), so it's called from the normal post-gate part of
// processDeadlines.
export async function resolveCheatRegionReverts(sessionId: string): Promise<void> {
  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  const gameDaysPerRealMinute = gs?.gameDaysPerRealMinute && gs.gameDaysPerRealMinute > 0 ? gs.gameDaysPerRealMinute : 1.5;
  const rows = await db.query.cheatRegionEffects.findMany({
    where: and(eq(cheatRegionEffects.sessionId, sessionId), eq(cheatRegionEffects.revertActive, true)),
  });
  if (rows.length === 0) return;

  const now = Date.now();
  for (const row of rows) {
    if (row.revertPhase === "counting_down" && row.revertStartedAt) {
      const elapsedGameDays = ((now - new Date(row.revertStartedAt).getTime()) / 60_000) * gameDaysPerRealMinute;
      if (elapsedGameDays >= CHEAT_REVERT_DURATION_GAME_DAYS) {
        await db
          .update(cheatRegionEffects)
          .set({ revertPhase: "revealed_winner", revertPhaseAt: new Date() })
          .where(and(eq(cheatRegionEffects.sessionId, sessionId), eq(cheatRegionEffects.regionId, row.regionId)));
        await broadcastGlobalMessage(
          sessionId,
          "A Winner Is Declared",
          `${row.regionId} has driven both infections and deaths to zero. The World Health Organization declares ${row.regionId} the winner of the pandemic response.`
        );
      }
    } else if (row.revertPhase === "revealed_winner" && row.revertPhaseAt) {
      const elapsedMs = now - new Date(row.revertPhaseAt).getTime();
      if (elapsedMs >= CHEAT_WINNER_REVEAL_PAUSE_SECONDS * 1000) {
        await db
          .update(cheatRegionEffects)
          .set({
            revertActive: false,
            revertPhase: null,
            revertPhaseAt: null,
            revertStartedAt: null,
            revertStartConfirmed: null,
            revertStartDeaths: null,
          })
          .where(and(eq(cheatRegionEffects.sessionId, sessionId), eq(cheatRegionEffects.regionId, row.regionId)));
        await broadcastGlobalMessage(sessionId, "Just Kidding!", `${row.regionId}'s infection and death counts return to what they actually were.`);
      }
    }
  }
}

// --- Display-layer overrides (used by app/api/dashboard + app/api/display) ---

type RevertRow = {
  revertActive: boolean;
  revertPhase: string | null;
  revertStartedAt: Date | string | null;
  revertStartConfirmed: number | null;
  revertStartDeaths: number | null;
};

export function computeRevertOverride(
  row: RevertRow | undefined,
  gameDaysPerRealMinute: number,
  now: number = Date.now()
): { confirmedCases: number; deaths: number } | null {
  if (!row || !row.revertActive) return null;
  if (row.revertPhase === "revealed_winner") return { confirmedCases: 0, deaths: 0 };
  if (row.revertPhase !== "counting_down" || !row.revertStartedAt || row.revertStartConfirmed == null || row.revertStartDeaths == null) return null;

  const elapsedGameDays = ((now - new Date(row.revertStartedAt).getTime()) / 60_000) * gameDaysPerRealMinute;
  const fraction = Math.max(0, Math.min(1, elapsedGameDays / CHEAT_REVERT_DURATION_GAME_DAYS));
  return {
    confirmedCases: Math.round(row.revertStartConfirmed * (1 - fraction)),
    deaths: Math.round(row.revertStartDeaths * (1 - fraction)),
  };
}

export async function getRevertOverridesForSession(
  sessionId: string,
  gameDaysPerRealMinute: number
): Promise<Record<string, { confirmedCases: number; deaths: number }>> {
  const rows = await db.query.cheatRegionEffects.findMany({
    where: and(eq(cheatRegionEffects.sessionId, sessionId), eq(cheatRegionEffects.revertActive, true)),
  });
  const out: Record<string, { confirmedCases: number; deaths: number }> = {};
  for (const row of rows) {
    const override = computeRevertOverride(row, gameDaysPerRealMinute);
    if (override) out[row.regionId] = override;
  }
  return out;
}

export interface CheatDisplayState {
  godModeActive: boolean;
  barrelRollAt: string | null;
  // startedAt lets the client compute which message is current and
  // re-derive it locally every second (see lib/use-monologue.ts), rather
  // than only being able to show whatever message happened to be current at
  // the moment of the last poll — dashboard/instructor pages poll every
  // 15s, far coarser than the MONOLOGUE_MESSAGE_SECONDS-per-message
  // cadence, so relying on index/text/secondsRemaining alone silently
  // skipped most of the sequence. Those three fields are kept as the
  // snapshot-at-poll-time fallback (e.g. for a first paint before the
  // client's own clock ticks).
  monologue: { index: number; total: number; text: string; secondsRemaining: number; startedAt: string } | null;
}

export async function getCheatDisplayState(sessionId: string): Promise<CheatDisplayState> {
  const state = await db.query.cheatCodeState.findFirst({ where: eq(cheatCodeState.sessionId, sessionId) });
  let monologue: CheatDisplayState["monologue"] = null;
  if (state?.monologueActive && state.monologueStartedAt) {
    const startedAt = new Date(state.monologueStartedAt);
    const elapsedSec = (Date.now() - startedAt.getTime()) / 1000;
    const index = Math.min(MONOLOGUE_MESSAGES.length - 1, Math.max(0, Math.floor(elapsedSec / MONOLOGUE_MESSAGE_SECONDS)));
    const secondsRemaining = Math.max(0, Math.ceil(MONOLOGUE_MESSAGES.length * MONOLOGUE_MESSAGE_SECONDS - elapsedSec));
    monologue = { index, total: MONOLOGUE_MESSAGES.length, text: MONOLOGUE_MESSAGES[index], secondsRemaining, startedAt: startedAt.toISOString() };
  }
  return {
    godModeActive: state?.godModeActive ?? false,
    barrelRollAt: state?.barrelRollAt ? new Date(state.barrelRollAt).toISOString() : null,
    monologue,
  };
}
