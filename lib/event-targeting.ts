// Live "who currently qualifies" hints for adaptive-trigger events, used by
// the Control page's dispatch picker. Reviewing every event's
// suggestedTargetRegions (lib/db/seed-data/events.ts) found that 14 of 16
// are correctly left null by design — their decisionPromptMarkdown
// genuinely calls on every region to respond (e.g. EVT-005/008/011: one
// region is the protagonist, but "all others indicate contribution/
// position"), and EVT-002 already has a correct static restricted default.
// The two real gaps are EVT-009 and EVT-013, whose trigger condition names
// a region (or regions) that can only be known from live game state — no
// static default is possible, and previously the instructor had to
// eyeball model state themselves to figure out who actually qualified.
// This computes that live, plus documents the fixed-but-unlisted named
// region for the other adaptive events so the Control page can show a
// consistent "currently qualifies" hint across all of them.
import { db } from "./db";

// Events whose trigger names one fixed region outright in prose — no live
// computation needed, just surfaced here so the UI can show every adaptive
// event's audience consistently, not just the two that need computing.
const FIXED_REGION_HINTS: Record<string, string[]> = {
  "EVT-005": ["SEARO"],
  "EVT-008": ["AMRO"],
  "EVT-011": ["AFRO"],
};

export async function computeEventTargetHints(): Promise<Record<string, string[]>> {
  const hints: Record<string, string[]> = { ...FIXED_REGION_HINTS };

  // EVT-009: "fires only if 2+ regions scored Inadequate/Critical on EVT-004"
  // — the qualifying audience is literally those regions once that's true.
  // Fetched as three batched queries (dispatches, then all their decisions,
  // then all those decisions' scores) rather than one round-trip per
  // dispatch, since there are only ever up to 6 EVT-004 dispatches but this
  // function runs on every Control page poll.
  const evt004Dispatches = await db.query.eventDispatches.findMany({
    where: (t, { eq: eqOp }) => eqOp(t.eventId, "EVT-004"),
  });
  const dispatchIds = evt004Dispatches.map((d) => d.id).filter((id): id is number => id != null);
  const allTeams = dispatchIds.length > 0 ? await db.query.teams.findMany() : [];
  const decisionsForDispatches =
    dispatchIds.length > 0 ? await db.query.decisions.findMany({ where: (t, { inArray }) => inArray(t.eventDispatchId, dispatchIds) }) : [];
  const decisionIds = decisionsForDispatches.map((d) => d.id);
  const scoresForDecisions =
    decisionIds.length > 0 ? await db.query.scores.findMany({ where: (t, { inArray }) => inArray(t.decisionId, decisionIds) }) : [];

  const evt004Poor: string[] = [];
  for (const d of evt004Dispatches) {
    if (!d.targetTeamId) continue;
    // Latest decision per dispatch (a team may have resubmitted before
    // scoring — see the option-cost refund flow in app/api/decisions).
    const decisionsForThisDispatch = decisionsForDispatches.filter((dec) => dec.eventDispatchId === d.id);
    const decision = decisionsForThisDispatch.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];
    if (!decision) continue;
    const score = scoresForDecisions.find((s) => s.decisionId === decision.id);
    if (score && (score.tier === "INADEQUATE" || score.tier === "CRITICAL_FAILURE")) {
      const team = allTeams.find((t) => t.id === d.targetTeamId);
      if (team) evt004Poor.push(team.regionId);
    }
  }
  if (evt004Poor.length >= 2) hints["EVT-009"] = evt004Poor;

  // EVT-013: "fires when any region's political tension index > 70"
  const allStates = await db.query.modelState.findMany();
  const tense = allStates.filter((s) => s.politicalTensionIndex > 70).map((s) => s.regionId);
  if (tense.length > 0) hints["EVT-013"] = tense;

  // Social-metric consequence arcs (EVT-017 through EVT-025) — each stage's
  // audience is just "whichever regions currently cross that threshold,"
  // computed the same way as EVT-013 above.
  const byThreshold = (predicate: (s: (typeof allStates)[number]) => boolean) =>
    allStates.filter(predicate).map((s) => s.regionId);

  const trustWarn = byThreshold((s) => s.publicTrustIndex < 45);
  const trustEsc1 = byThreshold((s) => s.publicTrustIndex < 30);
  const trustEsc2 = byThreshold((s) => s.publicTrustIndex < 15);
  if (trustWarn.length > 0) hints["EVT-017"] = trustWarn;
  if (trustEsc1.length > 0) hints["EVT-018"] = trustEsc1;
  if (trustEsc2.length > 0) hints["EVT-019"] = trustEsc2;

  const happyWarn = byThreshold((s) => s.populationHappinessIndex < 45);
  const happyEsc1 = byThreshold((s) => s.populationHappinessIndex < 30);
  const happyEsc2 = byThreshold((s) => s.populationHappinessIndex < 15);
  if (happyWarn.length > 0) hints["EVT-020"] = happyWarn;
  if (happyEsc1.length > 0) hints["EVT-021"] = happyEsc1;
  if (happyEsc2.length > 0) hints["EVT-022"] = happyEsc2;

  const tensionWarn = byThreshold((s) => s.politicalTensionIndex > 60);
  const tensionEsc1 = byThreshold((s) => s.politicalTensionIndex > 75);
  const tensionEsc2 = byThreshold((s) => s.politicalTensionIndex > 90);
  if (tensionWarn.length > 0) hints["EVT-023"] = tensionWarn;
  if (tensionEsc1.length > 0) hints["EVT-024"] = tensionEsc1;
  if (tensionEsc2.length > 0) hints["EVT-025"] = tensionEsc2;

  return hints;
}
