import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eventDispatches, instructorActions, globalFeedItems, teams, sessionState } from "@/lib/db/schema";
import { applyPathogenText } from "@/lib/pathogens";
import { visibleDisruptions } from "@/lib/disruptors";
import { and, eq } from "drizzle-orm";
import { requireActor, requireInstructorActor } from "@/lib/session-context";
import { computeAllChainStatus } from "@/lib/chain";
import { dispatchEventToRegions } from "@/lib/dispatch";
import { computeEventTargetHints } from "@/lib/event-targeting";

// GET: list all events with dispatch/chain status. Instructors see everything;
// students see only dispatches targeted at their team (or global broadcasts).
export async function GET() {
  const { actor, error } = await requireActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  // Release 5: event text names this session's pathogen (lib/pathogens.ts).
  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  const pt = (t: string) => applyPathogenText(t, gs?.pathogenId);
  const allEvents = (await db.query.events.findMany()).map((e) => ({
    ...e,
    narrativeMarkdown: pt(e.narrativeMarkdown),
    decisionPromptMarkdown: pt(e.decisionPromptMarkdown),
    structuredOptionsJson: (e.structuredOptionsJson as { text: string; impactDesc: string }[] | null)?.map((o) => ({ ...o, text: pt(o.text), impactDesc: pt(o.impactDesc) })) ?? null,
  }));
  const allDispatches = await db.query.eventDispatches.findMany({ where: eq(eventDispatches.sessionId, sessionId) });

  const chainStatus = await computeAllChainStatus(sessionId, allEvents.map((e) => e.id));

  if (actor!.role === "instructor") {
    const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });
    const targetHints = await computeEventTargetHints(sessionId);
    return NextResponse.json({
      events: allEvents,
      dispatches: allDispatches,
      chainStatus,
      teams: allTeams.map((t) => ({ id: t.id, regionId: t.regionId })),
      targetHints,
      mode: actor!.mode,
      // Release 5 event map: prerequisite links between events (global).
      chainLinks: (await db.query.eventChainLinks.findMany()).map((l) => ({ from: l.prevEventId, to: l.nextEventId })),
    });
  }

  const now = new Date();
  const myDispatches = allDispatches
    .filter((d) => d.targetTeamId === actor!.teamId)
    .map((d) => ({ ...d, disruptionsJson: visibleDisruptions(d.disruptionsJson, now) }));
  return NextResponse.json({ events: allEvents, dispatches: myDispatches, chainStatus });
}

// POST: instructor dispatches an event to a specific team, a specific set of
// regions, or globally (one dispatch row per targeted team, per
// simulation-docs/06-data-model.md note on GLOBAL-scope events).
export async function POST(req: NextRequest) {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json();
  const eventId = body.eventId as string;
  const targetTeamId = body.targetTeamId as number | null | undefined; // single-team shorthand
  const targetRegionIds = body.targetRegionIds as string[] | null | undefined; // preferred: explicit region picker from the Control page

  const result = await dispatchEventToRegions({
    sessionId,
    eventId,
    targetRegionIds,
    targetTeamId,
    dispatchedByUserId: actor!.userId,
    actionUserId: actor!.userId!,
    reason: body.reason ?? null,
    force: body.force === true,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ dispatches: result.dispatches });
}

export async function PATCH(req: NextRequest) {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json();
  const dispatchId = body.dispatchId as number;
  const headline = body.headline as string;

  const dispatch = await db.query.eventDispatches.findFirst({
    where: and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.id, dispatchId)),
  });
  if (!dispatch) return NextResponse.json({ error: "Dispatch not found" }, { status: 404 });

  await db.update(eventDispatches).set({ revealedToPublic: true }).where(eq(eventDispatches.id, dispatchId));
  await db.insert(globalFeedItems).values({ sessionId, headlineText: headline, eventDispatchId: dispatchId });
  await db.insert(instructorActions).values({
    sessionId,
    instructorUserId: actor!.userId!,
    actionType: "push_to_global_display",
    targetDesc: `dispatch ${dispatchId}: ${headline}`,
  });

  return NextResponse.json({ ok: true });
}
