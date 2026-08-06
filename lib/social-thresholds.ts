// Automatic "good direction" rewards for sustained high public trust/
// happiness or sustained low political tension — the mirror image of the
// bad-direction warning/escalation arcs (EVT-017 through EVT-025), which
// are real dispatched events the instructor paces. A milestone reward
// doesn't need a decision prompt ("you're doing great, here's a bonus"),
// so it's applied automatically the same way passive drift and the budget
// cycle timer are — called opportunistically from processDeadlines(). Each
// milestone can only ever fire once per session, per region+metric+tier (or
// once for the world-level version), tracked in socialMilestoneAwards.
import { db } from "./db";
import { sessionState, socialMilestoneAwards, modelState, teams, teamNotifications, globalFeedItems } from "./db/schema";
import { and, eq } from "drizzle-orm";
import { applyFieldDelta } from "./model-engine";

const REGION_THRESHOLDS = {
  publicTrust: { milestone1: 80, milestone2: 92 },
  happiness: { milestone1: 80, milestone2: 92 },
  politicalTension: { milestone1: 25, milestone2: 10 }, // low is good here
} as const;

const WORLD_THRESHOLDS = {
  publicTrust: 75,
  happiness: 75,
  politicalTension: 30, // low is good here
} as const;

async function alreadyAwarded(sessionId: string, regionId: string, metric: string, tier: string): Promise<boolean> {
  const existing = await db.query.socialMilestoneAwards.findFirst({
    where: and(
      eq(socialMilestoneAwards.sessionId, sessionId),
      eq(socialMilestoneAwards.regionId, regionId),
      eq(socialMilestoneAwards.metric, metric),
      eq(socialMilestoneAwards.tier, tier)
    ),
  });
  return !!existing;
}

async function recordAward(sessionId: string, regionId: string, metric: string, tier: string) {
  await db.insert(socialMilestoneAwards).values({ sessionId, regionId, metric, tier }).onConflictDoNothing();
}

async function notifyAll(sessionId: string, message: string, alsoPublic: boolean) {
  const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });
  if (allTeams.length > 0) {
    await db.insert(teamNotifications).values(allTeams.map((t) => ({ sessionId, teamId: t.id, kind: "consequence", message })));
  }
  if (alsoPublic) {
    await db.insert(globalFeedItems).values({ sessionId, headlineText: message });
  }
}

export async function checkSocialMilestones(sessionId: string) {
  const allStates = await db.query.modelState.findMany({ where: eq(modelState.sessionId, sessionId) });

  // --- Per-region milestones ---
  for (const state of allStates) {
    // Public trust: milestone1 at >=80 -> fund bonus; milestone2 at >=92 ->
    // a small Rt easing plus a further fund bonus (near-total compliance).
    if (state.publicTrustIndex >= REGION_THRESHOLDS.publicTrust.milestone1 && !(await alreadyAwarded(sessionId, state.regionId, "publicTrust", "milestone1"))) {
      await applyFieldDelta(sessionId, state.regionId, "fundRemaining", 300_000);
      await recordAward(sessionId, state.regionId, "publicTrust", "milestone1");
      await notifyAll(sessionId, `${state.regionId} has sustained public trust above 80/100 — donor confidence brings a $300K goodwill bonus.`, false);
    }
    if (state.publicTrustIndex >= REGION_THRESHOLDS.publicTrust.milestone2 && !(await alreadyAwarded(sessionId, state.regionId, "publicTrust", "milestone2"))) {
      await applyFieldDelta(sessionId, state.regionId, "fundRemaining", 200_000);
      await applyFieldDelta(sessionId, state.regionId, "rt", -0.05);
      await recordAward(sessionId, state.regionId, "publicTrust", "milestone2");
      await notifyAll(sessionId, `${state.regionId} has near-total public trust (92+/100) — exceptional compliance is easing transmission and drawing another $200K in support.`, true);
    }

    // Happiness: milestone1 -> HCW surge capacity bonus (volunteers show
    // up); milestone2 -> fund bonus plus political tension relief (a
    // genuinely content population is easier to govern).
    if (state.populationHappinessIndex >= REGION_THRESHOLDS.happiness.milestone1 && !(await alreadyAwarded(sessionId, state.regionId, "happiness", "milestone1"))) {
      await applyFieldDelta(sessionId, state.regionId, "hcwSurgePct", 5);
      await recordAward(sessionId, state.regionId, "happiness", "milestone1");
      await notifyAll(sessionId, `${state.regionId}'s population morale has stayed above 80/100 — volunteers are boosting healthcare worker surge capacity by 5%.`, false);
    }
    if (state.populationHappinessIndex >= REGION_THRESHOLDS.happiness.milestone2 && !(await alreadyAwarded(sessionId, state.regionId, "happiness", "milestone2"))) {
      await applyFieldDelta(sessionId, state.regionId, "fundRemaining", 300_000);
      await applyFieldDelta(sessionId, state.regionId, "politicalTensionIndex", -5);
      await recordAward(sessionId, state.regionId, "happiness", "milestone2");
      await notifyAll(sessionId, `${state.regionId}'s population morale is exceptional (92+/100) — a grateful public is easing political friction and drawing $300K in support.`, true);
    }

    // Political tension: LOW is good here. milestone1 (<=25) -> smoother
    // cooperation improves surveillance data quality; milestone2 (<=10) ->
    // member states reward the relationship with direct funding.
    if (state.politicalTensionIndex <= REGION_THRESHOLDS.politicalTension.milestone1 && !(await alreadyAwarded(sessionId, state.regionId, "politicalTension", "milestone1"))) {
      await applyFieldDelta(sessionId, state.regionId, "surveillanceIndex", 1);
      await recordAward(sessionId, state.regionId, "politicalTension", "milestone1");
      await notifyAll(sessionId, `${state.regionId}'s relationship with member states has stayed smooth (tension under 25) — improved cooperation is boosting surveillance quality.`, false);
    }
    if (state.politicalTensionIndex <= REGION_THRESHOLDS.politicalTension.milestone2 && !(await alreadyAwarded(sessionId, state.regionId, "politicalTension", "milestone2"))) {
      await applyFieldDelta(sessionId, state.regionId, "fundRemaining", 400_000);
      await recordAward(sessionId, state.regionId, "politicalTension", "milestone2");
      await notifyAll(sessionId, `${state.regionId}'s member-state relationships are exceptionally strong (tension under 10) — a $400K goodwill contribution follows.`, true);
    }
  }

  // --- World-level milestones (global averages) ---
  if (allStates.length > 0) {
    const avgTrust = allStates.reduce((s, m) => s + m.publicTrustIndex, 0) / allStates.length;
    const avgHappiness = allStates.reduce((s, m) => s + m.populationHappinessIndex, 0) / allStates.length;
    const avgTension = allStates.reduce((s, m) => s + m.politicalTensionIndex, 0) / allStates.length;

    if (avgTrust >= WORLD_THRESHOLDS.publicTrust && !(await alreadyAwarded(sessionId, "GLOBAL", "publicTrust", "milestone1"))) {
      const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
      if (gs)
        await db
          .update(sessionState)
          .set({ mediaPressureIndex: Math.max(0, gs.mediaPressureIndex - 10), updatedAt: new Date() })
          .where(eq(sessionState.sessionId, sessionId));
      await recordAward(sessionId, "GLOBAL", "publicTrust", "milestone1");
      await notifyAll(sessionId, `Global public trust has climbed above 75/100 — international media pressure eases as the world's response reads as credible.`, true);
    }
    if (avgHappiness >= WORLD_THRESHOLDS.happiness && !(await alreadyAwarded(sessionId, "GLOBAL", "happiness", "milestone1"))) {
      const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
      if (gs)
        await db
          .update(sessionState)
          .set({ whoHqFund: gs.whoHqFund + 5_000_000, updatedAt: new Date() })
          .where(eq(sessionState.sessionId, sessionId));
      await recordAward(sessionId, "GLOBAL", "happiness", "milestone1");
      await notifyAll(sessionId, `Global population morale has climbed above 75/100 — renewed donor confidence adds $5M to WHO HQ's emergency fund.`, true);
    }
    if (avgTension <= WORLD_THRESHOLDS.politicalTension && !(await alreadyAwarded(sessionId, "GLOBAL", "politicalTension", "milestone1"))) {
      const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
      if (gs)
        await db
          .update(sessionState)
          .set({ whoHqPpeStock: gs.whoHqPpeStock + 200, whoHqAntiviralsStock: gs.whoHqAntiviralsStock + 20_000, updatedAt: new Date() })
          .where(eq(sessionState.sessionId, sessionId));
      await recordAward(sessionId, "GLOBAL", "politicalTension", "milestone1");
      await notifyAll(sessionId, `Global political tension has stayed low (world average under 30) — smooth member-state cooperation restocks WHO HQ's PPE and antiviral supply.`, true);
    }
  }
}
