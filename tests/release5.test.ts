import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { eventDispatches, modelState, sessionState, teams } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { resetDb, seedStaticOnce } from "./helpers/db";
import { createTestSession, createTestUser } from "./helpers/session";
import { createSession } from "@/lib/session-lifecycle";
import { PATHOGENS, applyPathogenText, countermeasureUnits, startingRtFor } from "@/lib/pathogens";
import { computeEpidemicGrowth } from "@/lib/model-engine";
import { planDisruptions, removedOptions, activeDisruptions, applyDisruptionConsequences } from "@/lib/disruptors";
import { disruptorSeed } from "@/lib/db/seed-data/disruptors";
import { dispatchEventToRegions } from "@/lib/dispatch";
import { submitDecision } from "@/lib/decisions";
import { contributeToResearch, RD_MILESTONES } from "@/lib/research";
import { computeEventTargetHints } from "@/lib/event-targeting";
import { regionSeed } from "@/lib/db/seed-data/regions";
import { eventSeed } from "@/lib/db/seed-data/events";

const MIN = 60_000;

describe("pathogens (pure)", () => {
  it("adapts scenario text to the pathogen and leaves the coronavirus alone", () => {
    const t = "SEARO's sequence is missing the spike protein RBD; NCoV-X1 spreads; antivirals are short; one antiviral course.";
    expect(applyPathogenText(t, "ncov")).toBe(t);
    const plague = applyPathogenText(t, "plague");
    expect(plague).toContain(PATHOGENS.plague.codeName);
    expect(plague).toContain("antibiotics are short");
    expect(plague).toContain("one antibiotic course");
    expect(plague).not.toContain("spike protein");
  });

  it("adapts the briefing's opening line to every pathogen", () => {
    const intro = "A novel betacoronavirus (NCoV-X1) has emerged.";
    expect(applyPathogenText(intro, "ncov")).toBe(intro);
    for (const id of ["flu", "plague", "nipah"] as const) {
      const out = applyPathogenText(intro, id);
      expect(out).toBe(`${PATHOGENS[id].intro} has emerged.`);
      expect(out).not.toMatch(/coronavirus|NCoV/);
    }
  });

  it("names the stockpile for the pathogen in forms and ledgers", () => {
    expect(countermeasureUnits("ncov")).toMatchObject({ formLabel: "Antivirals (doses)", phrase: "antiviral doses" });
    expect(countermeasureUnits("plague")).toMatchObject({ formLabel: "Antibiotics (courses)", phrase: "antibiotic courses", unit: "course" });
    expect(countermeasureUnits("nipah").phrase).toBe("monoclonal antibody courses");
    expect(countermeasureUnits(undefined).formLabel).toBe("Antivirals (doses)");
  });

  it("keeps every game's outbreak growing at the start", () => {
    for (const p of Object.values(PATHOGENS)) for (const r of regionSeed) expect(startingRtFor(r.startingRt, p)).toBeGreaterThanOrEqual(1.05);
  });

  it("a longer serial interval means slower growth at the same Rt; deaths are capped", () => {
    const before = { rt: 1.5, cfrMultiplier: 3, confirmedCases: 1000, estimatedTrueCasesLow: 8000, estimatedTrueCasesHigh: 15000 };
    const ncov = computeEpidemicGrowth(before, 10, 1e9, PATHOGENS.ncov);
    const nipah = computeEpidemicGrowth(before, 10, 1e9, PATHOGENS.nipah);
    expect(nipah.newConfirmed).toBeLessThan(ncov.newConfirmed);
    expect(nipah.newDeaths).toBeLessThanOrEqual(Math.round(nipah.newConfirmed * 0.95));
  });

  it("every disruptor and new event points at real events and options", () => {
    for (const d of disruptorSeed) {
      const ev = eventSeed.find((e) => e.id === d.eventId);
      expect(ev, d.id).toBeDefined();
      const labels = (ev!.structuredOptionsJson ?? []).map((o) => o.label);
      for (const o of d.options) expect(labels, d.id).toContain(o);
    }
    for (const id of ["EVT-026", "EVT-027", "EVT-028", "EVT-029"]) expect(eventSeed.some((e) => e.id === id && !e.isCorePath)).toBe(true);
  });
});

describe("disruptor timing (pure)", () => {
  it("draws by probability, lands inside the window, and only counts once its time comes", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date(start.getTime() + 10 * MIN);
    expect(planDisruptions("EVT-011", "AFRO", start, end, () => 0.99)).toEqual([]); // not drawn
    const plan = planDisruptions("EVT-011", "AFRO", start, end, () => 0); // drawn, earliest point
    expect(plan).toHaveLength(1);
    const at = new Date(plan[0].at);
    expect(at.getTime()).toBe(start.getTime() + 0.15 * 10 * MIN);
    expect(removedOptions(plan, new Date(at.getTime() - 1000)).size).toBe(0);
    expect(removedOptions(plan, at).has("A")).toBe(true);
    expect(planDisruptions("EVT-008", "AFRO", start, end, () => 0)).toEqual([]); // AMRO-only
    expect(planDisruptions("EVT-001", "AFRO", start, null, () => 0)).toEqual([]); // untimed
  });
});

describe("Release 5 (DB)", () => {
  beforeEach(async () => {
    await resetDb();
    await seedStaticOnce();
  });

  it("a session's pathogen scales starting Rt", async () => {
    const owner = await createTestUser("instructor");
    const sid = await createSession(owner.id, "instructor", { pathogenId: "plague" });
    const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sid) });
    expect(gs!.pathogenId).toBe("plague");
    const afro = await db.query.modelState.findFirst({ where: and(eq(modelState.sessionId, sid), eq(modelState.regionId, "AFRO")) });
    const seed = regionSeed.find((r) => r.id === "AFRO")!;
    expect(afro!.rt).toBeCloseTo(startingRtFor(seed.startingRt, PATHOGENS.plague), 5);
  });

  it("a removed option can't be submitted after the disruption lands", async () => {
    const { sessionId, ownerUserId } = await createTestSession("instructor");
    const r = await dispatchEventToRegions({ sessionId, eventId: "EVT-001", dispatchedByUserId: ownerUserId, actionUserId: ownerUserId });
    if (!r.ok) throw new Error(r.error);
    const d = r.dispatches[0];
    // Plan an EVT-011-style removal of option C on this dispatch, already active.
    const fake = [{ id: "DIS-007", at: new Date(Date.now() - 1000).toISOString() }]; // removes "B" (on EVT-009 normally)
    await db.update(eventDispatches).set({ disruptionsJson: fake }).where(eq(eventDispatches.id, d.id));
    const res = await submitDecision({
      sessionId,
      teamId: d.targetTeamId!,
      eventDispatchId: d.id,
      structuredChoice: "B",
      rationaleText: "x",
      confidenceLevel: "MEDIUM",
      actor: { kind: "team", userId: null },
    });
    expect("error" in res && res.error).toMatch(/no longer available/);
  });

  it("a warned choice shrinks WHO's fund in that session only", async () => {
    const a = await createTestSession("instructor");
    const b = await createTestSession("instructor");
    const r = await dispatchEventToRegions({ sessionId: a.sessionId, eventId: "EVT-001", dispatchedByUserId: a.ownerUserId, actionUserId: a.ownerUserId });
    if (!r.ok) throw new Error(r.error);
    const d = { ...r.dispatches[0], disruptionsJson: [{ id: "DIS-001", at: new Date(Date.now() - 1000).toISOString() }] };
    expect(activeDisruptions(d.disruptionsJson)).toHaveLength(1);
    const before = (await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, a.sessionId) }))!.whoHqFund;
    const applied = await applyDisruptionConsequences({ sessionId: a.sessionId, dispatch: d, structuredChoice: "A", submittedAt: new Date(), regionId: "AFRO" });
    expect(applied).toEqual(["DIS-001"]);
    const after = (await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, a.sessionId) }))!.whoHqFund;
    expect(after).toBe(Math.floor(before * 0.95));
    const other = (await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, b.sessionId) }))!.whoHqFund;
    expect(other).toBe(before);
    // Choosing an unaffected option, or submitting before it landed, costs nothing.
    expect(await applyDisruptionConsequences({ sessionId: a.sessionId, dispatch: d, structuredChoice: "C", submittedAt: new Date(), regionId: "AFRO" })).toEqual([]);
    expect(await applyDisruptionConsequences({ sessionId: a.sessionId, dispatch: d, structuredChoice: "A", submittedAt: new Date(Date.now() - 60_000), regionId: "AFRO" })).toEqual([]);
  });

  it("R&D contributions are atomic, milestones fire once, and sessions are isolated", async () => {
    const a = await createTestSession("instructor");
    const b = await createTestSession("instructor");
    await db
      .update(sessionState)
      .set({ simulationStatus: "running", simulationStartedAt: new Date(Date.now() - 5 * MIN) })
      .where(eq(sessionState.sessionId, a.sessionId));
    // EURO and AMRO have large budgets; pool past the final milestone concurrently.
    const results = await Promise.all([
      contributeToResearch(a.sessionId, "EURO", 70_000_000),
      contributeToResearch(a.sessionId, "AMRO", 60_000_000),
      contributeToResearch(a.sessionId, "EURO", 1_000_000_000_000), // can't afford: refused, nothing moves
    ]);
    expect(results.map((r) => r.ok)).toEqual([true, true, false]);
    const gs = (await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, a.sessionId) }))!;
    expect(gs.rdFund).toBe(130_000_000);
    expect(gs.rdContributions).toEqual({ EURO: 70_000_000, AMRO: 60_000_000 });
    expect(gs.rdMilestone).toBe(RD_MILESTONES.length);
    expect(gs.rdBacklashRolled).toBe(true);
    const fired = results.flatMap((r) => (r.ok ? r.newMilestones.map((m) => m.level) : []));
    expect(fired.sort()).toEqual([1, 2, 3]); // each exactly once
    const gb = (await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, b.sessionId) }))!;
    expect(gb.rdFund).toBe(0);
    expect((await computeEventTargetHints(a.sessionId))["EVT-026"]).toHaveLength(6);
    expect((await computeEventTargetHints(b.sessionId))["EVT-026"]).toBeUndefined();
  });

  it("the facilitator can fire an event before its prerequisites, but only deliberately", async () => {
    const { sessionId, ownerUserId } = await createTestSession("instructor");
    const blocked = await dispatchEventToRegions({ sessionId, eventId: "EVT-002", dispatchedByUserId: ownerUserId, actionUserId: ownerUserId });
    expect(blocked.ok).toBe(false);
    const forced = await dispatchEventToRegions({ sessionId, eventId: "EVT-002", dispatchedByUserId: ownerUserId, actionUserId: ownerUserId, force: true });
    expect(forced.ok).toBe(true);
    const log = await db.query.instructorActions.findFirst({ where: (t, { eq: e }) => e(t.sessionId, sessionId) });
    expect(log?.reason).toMatch(/before prerequisites/);
    expect(await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) })).toHaveLength(6);
  });
});
