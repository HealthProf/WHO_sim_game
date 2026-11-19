import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { eventDispatches, scores, sessionState, teams, modelState } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { resetDb, seedStaticOnce } from "./helpers/db";
import { createTestSession } from "./helpers/session";
import { dispatchEventToRegions } from "@/lib/dispatch";
import { submitDecision } from "@/lib/decisions";
import { scoreDecision, pendingSubmissions } from "@/lib/score-decision";
import { runAutoAccept } from "@/lib/auto-accept";
import { featureUnlocksFor } from "@/lib/feature-gate";

const RATIONALE =
  "Transmission data and the Rt estimate justify a declaration under IHR Article 12 now. It is politically costly with the host government, so we pair it with a negotiated data-sharing offer and budget. Vulnerable, low-resource regions bear the highest burden, so equity safeguards come first.";

async function setup(sessionId: string, ownerUserId: number, regionId = "AFRO") {
  const r = await dispatchEventToRegions({ sessionId, eventId: "EVT-001", dispatchedByUserId: ownerUserId, actionUserId: ownerUserId });
  if (!r.ok) throw new Error(r.error);
  const team = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, sessionId), eq(teams.regionId, regionId)) });
  const dispatch = r.dispatches.find((d) => d.targetTeamId === team!.id)!;
  return { team: team!, dispatch };
}

async function submit(sessionId: string, teamId: number, dispatchId: number, choice: string) {
  const res = await submitDecision({
    sessionId,
    teamId,
    eventDispatchId: dispatchId,
    structuredChoice: choice,
    rationaleText: RATIONALE,
    confidenceLevel: "MEDIUM",
    actor: { kind: "team", userId: null },
  });
  if ("error" in res) throw new Error(res.error);
  return res.decision;
}

describe("Release 2 scoring", () => {
  beforeEach(async () => {
    await resetDb();
    await seedStaticOnce();
  });

  it("only the latest resubmission is pending, and an event can only be scored once", async () => {
    const { sessionId, ownerUserId } = await createTestSession("instructor");
    const { team, dispatch } = await setup(sessionId, ownerUserId);
    const first = await submit(sessionId, team.id, dispatch.id, "A");
    const second = await submit(sessionId, team.id, dispatch.id, "B");

    const pending = await pendingSubmissions(sessionId);
    expect(pending.map((d) => d.id)).toEqual([second.id]);

    await expect(scoreDecision(sessionId, { decisionId: first.id, acceptProvisional: true }, ownerUserId)).rejects.toThrow(/newer submission/);

    // Two concurrent accepts of the same decision: exactly one applies.
    const results = await Promise.allSettled([
      scoreDecision(sessionId, { decisionId: second.id, acceptProvisional: true, confirmReview: true }, ownerUserId),
      scoreDecision(sessionId, { decisionId: second.id, acceptProvisional: true, confirmReview: true }, ownerUserId),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.query.scores.findMany({ where: eq(scores.sessionId, sessionId) })).toHaveLength(1);
    expect(await pendingSubmissions(sessionId)).toHaveLength(0);
  });

  it("stores the realized (varied) deltas and keeps index fields integral", async () => {
    const { sessionId, ownerUserId } = await createTestSession("instructor");
    const { team, dispatch } = await setup(sessionId, ownerUserId);
    const d = await submit(sessionId, team.id, dispatch.id, "A");
    const score = await scoreDecision(sessionId, { decisionId: d.id, acceptProvisional: true, confirmReview: true }, ownerUserId, { rng: () => 0.999 });
    const applied = score.appliedDeltasJson as { field: string; delta: number }[];
    expect(Array.isArray(applied)).toBe(true);
    for (const a of applied) if (a.field !== "rt" && a.field !== "cfrMultiplier") expect(Number.isInteger(a.delta)).toBe(true);
    const state = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sessionId), eq(modelState.regionId, "AFRO")) });
    expect(Number.isInteger(state!.publicTrustIndex)).toBe(true);
  });

  it("auto-accept is off by default, respects the grace period and review flags, and stays in its own session", async () => {
    const a = await createTestSession("instructor");
    const b = await createTestSession("instructor");
    const sa = await setup(a.sessionId, a.ownerUserId);
    const sb = await setup(b.sessionId, b.ownerUserId);
    // EVT-001 option A is designed Optimal and isn't a mandatory-review event.
    const da = await submit(a.sessionId, sa.team.id, sa.dispatch.id, "A");
    await submit(b.sessionId, sb.team.id, sb.dispatch.id, "A");

    const later = new Date(Date.now() + 120_000);
    expect(await runAutoAccept(a.sessionId, later)).toBe(0); // off

    for (const s of [a, b]) await db.update(sessionState).set({ autoAcceptScores: true }).where(eq(sessionState.sessionId, s.sessionId));
    expect(await runAutoAccept(a.sessionId, new Date())).toBe(0); // inside grace period
    expect(await runAutoAccept(a.sessionId, later)).toBe(1);

    const scoredA = await db.query.scores.findFirst({ where: eq(scores.decisionId, da.id) });
    expect(scoredA?.fastPathed).toBe(true);
    expect(await db.query.scores.findMany({ where: eq(scores.sessionId, b.sessionId) })).toHaveLength(0);

    // A critical-failure-designed choice needs review and is never auto-accepted.
    const team2 = await db.query.teams.findFirst({ where: and(eq(teams.sessionId, a.sessionId), eq(teams.regionId, "EURO")) });
    const d2 = (await db.query.eventDispatches.findMany({ where: eq(eventDispatches.sessionId, a.sessionId) })).find((d) => d.targetTeamId === team2!.id)!;
    const ev = await db.query.events.findFirst({ where: (t, { eq: e }) => e(t.id, "EVT-001") });
    const critical = (ev!.structuredOptionsJson as { label: string; suggestedTier: string }[]).find((o) => o.suggestedTier === "CRITICAL_FAILURE");
    if (critical) {
      await submit(a.sessionId, team2!.id, d2.id, critical.label);
      expect(await runAutoAccept(a.sessionId, later)).toBe(0);
    }
  });
});

describe("phased feature unlock", () => {
  beforeEach(async () => {
    await resetDb();
    await seedStaticOnce();
  });

  it("opens pledges after 3 released events and the market after 5, per session", async () => {
    const a = await createTestSession("instructor");
    const b = await createTestSession("instructor");
    expect((await featureUnlocksFor(a.sessionId)).pledges.open).toBe(false);

    for (const id of ["EVT-001", "EVT-004", "EVT-005"]) {
      const r = await dispatchEventToRegions({ sessionId: a.sessionId, eventId: id, dispatchedByUserId: a.ownerUserId, actionUserId: a.ownerUserId });
      expect(r.ok).toBe(true);
    }
    const ua = await featureUnlocksFor(a.sessionId);
    expect(ua.pledges.open).toBe(true);
    expect(ua.market).toMatchObject({ open: false, eventsUntilOpen: 2 });
    expect((await featureUnlocksFor(b.sessionId)).pledges.open).toBe(false);

    await db.update(sessionState).set({ featuresUnlockedEarly: true }).where(eq(sessionState.sessionId, b.sessionId));
    expect((await featureUnlocksFor(b.sessionId)).market.open).toBe(true);
  });

  it("solo play keeps everything open", async () => {
    const demo = await createTestSession("demo");
    const u = await featureUnlocksFor(demo.sessionId);
    expect(u.pledges.open && u.market.open).toBe(true);
  });
});

