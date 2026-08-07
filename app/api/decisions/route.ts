import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decisions, eventDispatches } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { requireActor, requireTeamActor } from "@/lib/session-context";
import { submitDecision } from "@/lib/decisions";
import { logAnalyticsEvent } from "@/lib/analytics";

// POST: a team submits a decision for a dispatch targeted at them. Thin
// auth + validation wrapper over lib/decisions.ts's submitDecision(), which
// is also the autoplayer's submission path (lib/autoplayer/scripted.ts) —
// see that file for why there's deliberately only one code path here.
export async function POST(req: NextRequest) {
  const { actor, error } = await requireTeamActor();
  if (error) return error;

  const body = await req.json();
  const confidenceLevel = ["LOW", "MEDIUM", "HIGH"].includes(body.confidenceLevel) ? body.confidenceLevel : null;

  const result = await submitDecision({
    sessionId: actor!.sessionId,
    teamId: actor!.teamId!,
    eventDispatchId: body.eventDispatchId as number,
    structuredChoice: (body.structuredChoice as string) ?? null,
    rationaleText: (body.rationaleText as string) ?? "",
    resourceAllocationJson: body.resourceAllocationJson,
    coordinatedWithTeamsJson: body.coordinatedWithTeamsJson,
    confidenceLevel,
    actor: { kind: actor!.isOwner ? "owner" : "team", userId: actor!.userId },
  });

  if ("error" in result) {
    const status = result.error === "Dispatch not found" || result.error === "Team not found" || result.error === "Event not found" ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  await logAnalyticsEvent({
    sessionId: actor!.sessionId,
    mode: actor!.mode,
    eventType: "decision_submitted",
    actorRole: actor!.role,
    regionId: actor!.regionId,
    userId: actor!.userId,
    metadata: { eventDispatchId: body.eventDispatchId, structuredChoice: body.structuredChoice ?? null, confidenceLevel },
  });

  return NextResponse.json({ decision: result.decision });
}

export async function GET(req: NextRequest) {
  const { actor, error } = await requireActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const { searchParams } = new URL(req.url);
  const dispatchId = searchParams.get("eventDispatchId");

  if (dispatchId) {
    // Ownership check: the dispatch must belong to this actor's session, and
    // a team actor may only see decisions for a dispatch targeted at them —
    // previously this had no check at all and returned every decision for
    // any eventDispatchId, which becomes a cross-session leak once other
    // sessions' dispatch ids exist.
    const dispatch = await db.query.eventDispatches.findFirst({
      where: and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.id, Number(dispatchId))),
    });
    if (!dispatch) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (actor!.role === "student" && dispatch.targetTeamId !== actor!.teamId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const rows = await db.query.decisions.findMany({
      where: and(eq(decisions.sessionId, sessionId), eq(decisions.eventDispatchId, Number(dispatchId))),
    });
    return NextResponse.json({ decisions: rows });
  }

  if (actor!.role === "instructor") {
    const rows = await db.query.decisions.findMany({ where: eq(decisions.sessionId, sessionId) });
    return NextResponse.json({ decisions: rows });
  }

  const rows = await db.query.decisions.findMany({ where: and(eq(decisions.sessionId, sessionId), eq(decisions.teamId, actor!.teamId!)) });
  return NextResponse.json({ decisions: rows });
}
