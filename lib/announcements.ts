// Popup announcements — two flavors, both triggered automatically (never a
// manual facilitator step):
//
// 1. "event_dispatched" — fires every time an event is dispatched. Global
//    display gets a 10s auto-dismiss banner; every targeted team gets a
//    persistent popup (closed only by the team, since a missed toast is
//    easy to lose in a live session).
// 2. "decision_resolved" — fires only for events targeted at a subset of
//    regions (see lib/db/seed-data/events.ts suggestedTargetRegions and
//    03-events.md — e.g. EVT-002's SEARO/WPRO/EURO-only data-sharing
//    standoff) once every targeted dispatch has been scored, so the whole
//    room learns the outcome of a decision only a few regions actually
//    made. Global display gets a 10s auto-dismiss banner; every team
//    (not just the ones who decided) gets a persistent popup.
//
// A third, lighter mechanism lives at the bottom of this file:
// announceDecisionRevealed() fires on EVERY scored decision, for every
// event regardless of scope/audience, and posts to teamNotifications (the
// dashboard's "Recent Developments" list) rather than a modal — a routine
// decision from a region you weren't watching shouldn't interrupt anyone,
// but it should still be visible to everyone once it's scored, so the
// tension from who-got-targeted-with-what (see lib/event-targeting.ts) and
// who-chose-what actually lands on the rest of the room instead of staying
// invisible outside the deciding region and the instructor.

import { db } from "./db";
import { announcements, announcementAcks, teamNotifications } from "./db/schema";
import { and, eq } from "drizzle-orm";
import type { Tier } from "./db/seed-data/events";
import {
  ANNOUNCEMENT_AUTO_DISMISS_SECONDS as GLOBAL_AUTO_DISMISS_SECONDS,
  DRAMATIC_MOMENT_AUTO_DISMISS_SECONDS,
} from "./config";

// Item 2's "scripted midpoint gut-punch" — a small set of events written as
// the session's emotionally significant beats (see EVT-011's narrative:
// "this is meant to be the simulation's most emotionally significant
// moment") get a distinct full-screen projector takeover instead of the
// routine 10s dispatch banner. Deliberately just a set of IDs, not a field
// on the event itself — staging a moment is a facilitation/production
// choice, not a property of the event content.
const DRAMATIC_MOMENT_EVENT_IDS = new Set(["EVT-011"]);
const DRAMATIC_MOMENT_COPY: Record<string, { title: string; message: string }> = {
  "EVT-011": {
    title: "A System at Its Limit",
    message: "AFRO's healthcare system has reached saturation. Bed occupancy exceeds 95%, with zero reserve capacity. What every region does next will be remembered.",
  },
};

export async function announceDispatch(opts: { eventId: string; eventTitle: string; targetTeamIds: number[] }) {
  const { eventId, eventTitle, targetTeamIds } = opts;
  const allTeams = await db.query.teams.findMany();
  const isAllTeams = targetTeamIds.length >= allTeams.length;

  let audienceDesc = "all regions";
  if (!isAllTeams) {
    const regionIds = targetTeamIds.map((id) => allTeams.find((t) => t.id === id)?.regionId).filter(Boolean);
    audienceDesc = regionIds.join(", ");
  }

  if (DRAMATIC_MOMENT_EVENT_IDS.has(eventId)) {
    const copy = DRAMATIC_MOMENT_COPY[eventId] ?? { title: eventTitle, message: `"${eventTitle}" has just been dispatched.` };
    await db.insert(announcements).values({
      scope: "global_display",
      kind: "dramatic_moment",
      eventId,
      targetTeamIds: null,
      title: copy.title,
      message: copy.message,
      autoDismissSeconds: DRAMATIC_MOMENT_AUTO_DISMISS_SECONDS,
    });
  } else {
    await db.insert(announcements).values({
      scope: "global_display",
      kind: "event_dispatched",
      eventId,
      targetTeamIds: null,
      title: "New Event Dispatched",
      message: `"${eventTitle}" has just been dispatched to ${audienceDesc} — teams, check your Events page.`,
      autoDismissSeconds: GLOBAL_AUTO_DISMISS_SECONDS,
    });
  }

  await db.insert(announcements).values({
    scope: "team",
    kind: "event_dispatched",
    eventId,
    targetTeamIds: isAllTeams ? null : targetTeamIds,
    title: "New Event",
    message: `A new event has arrived: "${eventTitle}." Check your Events page to respond.`,
    autoDismissSeconds: null,
  });
}

// Called after every scoring action (instructor scoring inbox, and the
// deadline-expiry auto-fallback) for the event the just-scored dispatch
// belongs to. No-ops unless (a) the event was targeted at fewer than all
// six regions, (b) every targeted dispatch is now scored/closed, and (c)
// this hasn't already been announced.
export async function maybeAnnounceResolution(eventId: string) {
  const { eventDispatches, events } = await import("./db/schema");

  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return;

  const dispatches = await db.query.eventDispatches.findMany({ where: eq(eventDispatches.eventId, eventId) });
  const allTeams = await db.query.teams.findMany();
  if (dispatches.length === 0 || dispatches.length >= allTeams.length) return; // only region-restricted events

  const allResolved = dispatches.every((d) => d.status === "scored" || d.status === "closed");
  if (!allResolved) return;

  const alreadyAnnounced = await db.query.announcements.findFirst({
    where: and(eq(announcements.eventId, eventId), eq(announcements.kind, "decision_resolved"), eq(announcements.scope, "global_display")),
  });
  if (alreadyAnnounced) return;

  const dispatchIds = dispatches.map((d) => d.id);
  const decisionsForDispatches = await db.query.decisions.findMany({ where: (t, { inArray }) => inArray(t.eventDispatchId, dispatchIds) });
  const decisionIds = decisionsForDispatches.map((d) => d.id);
  const scoresForDecisions = decisionIds.length > 0 ? await db.query.scores.findMany({ where: (t, { inArray }) => inArray(t.decisionId, decisionIds) }) : [];

  const outcomeParts: string[] = [];
  for (const d of dispatches) {
    const team = allTeams.find((t) => t.id === d.targetTeamId);
    // A team may have resubmitted before scoring (see the option-cost
    // refund flow in app/api/decisions/route.ts) — only the latest
    // submission is ever the one actually scored, so pick that one rather
    // than whichever row happened to be inserted first.
    const decision = decisionsForDispatches
      .filter((dec) => dec.eventDispatchId === d.id)
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];
    const score = decision ? scoresForDecisions.find((s) => s.decisionId === decision.id) : null;
    if (team && score) outcomeParts.push(`${team.regionId}: ${score.tier.replace("_", " ")}`);
  }
  const summary = `${event.title} — final decision: ${outcomeParts.join(", ")}.`;

  await db.insert(announcements).values({
    scope: "global_display",
    kind: "decision_resolved",
    eventId,
    targetTeamIds: null,
    title: "Final Decision",
    message: summary,
    autoDismissSeconds: GLOBAL_AUTO_DISMISS_SECONDS,
  });

  await db.insert(announcements).values({
    scope: "team",
    kind: "decision_resolved",
    eventId,
    targetTeamIds: null, // every team is informed, even ones who didn't decide
    title: "Final Decision",
    message: summary,
    autoDismissSeconds: null,
  });
}

// Deliberately generous window (60s, regardless of the ~10s the popup is
// actually meant to be *visible* for) — the display page polls every few
// seconds, and if this only matched the exact autoDismissSeconds window, a
// slow poll cycle could miss a transient announcement's window entirely. The
// client tracks its own "first seen" timestamp per announcement id and
// displays it for exactly autoDismissSeconds from there, so returning a
// slightly-stale announcement here never makes it visually overstay.
export async function getActiveGlobalAnnouncement() {
  const recent = await db.query.announcements.findFirst({
    where: eq(announcements.scope, "global_display"),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  if (!recent) return null;
  const ageMs = Date.now() - new Date(recent.createdAt).getTime();
  return ageMs <= 60_000 ? recent : null;
}

export async function getTeamAnnouncements(teamId: number) {
  const acked = await db.query.announcementAcks.findMany({ where: eq(announcementAcks.teamId, teamId) });
  const ackedIds = new Set(acked.map((a) => a.announcementId));

  const candidates = await db.query.announcements.findMany({
    where: eq(announcements.scope, "team"),
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  });

  return candidates.filter((a) => {
    if (ackedIds.has(a.id)) return false;
    const targets = a.targetTeamIds as number[] | null;
    return targets === null || targets.includes(teamId);
  });
}

export async function ackAnnouncement(announcementId: number, teamId: number) {
  await db.insert(announcementAcks).values({ announcementId, teamId }).onConflictDoNothing();
}

// Called right after every scored decision (instructor scoring inbox and
// the deadline-expiry auto-fallback), for every event unconditionally —
// unlike maybeAnnounceResolution above, this doesn't wait for a whole
// restricted-audience group to finish or check how many regions the event
// went to. Every other region gets a plain "REGION chose OPTION — TIER"
// line (option label + tier only, never the submitted rationale text —
// that stays private to the deciding team, same boundary the public
// display already enforces). The deciding team doesn't get this — they
// already got their own richer consequence card from pushConsequence().
export async function announceDecisionRevealed(opts: {
  eventId: string;
  eventTitle: string;
  regionId: string;
  submittingTeamId: number;
  structuredChoice: string | null;
  tier: Tier;
}) {
  const { eventTitle, regionId, submittingTeamId, structuredChoice, tier } = opts;

  const choiceDesc = structuredChoice ? `chose ${structuredChoice}` : "submitted its decision";
  const message = `${regionId} ${choiceDesc} on "${eventTitle}" — scored ${tier.replace("_", " ")}.`;

  const allTeams = await db.query.teams.findMany();
  const otherTeams = allTeams.filter((t) => t.id !== submittingTeamId);
  if (otherTeams.length > 0) {
    await db.insert(teamNotifications).values(otherTeams.map((t) => ({ teamId: t.id, kind: "decision_revealed", message })));
  }
}
