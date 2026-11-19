import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decisions, eventDispatches, scores } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { requireTeamActor } from "@/lib/session-context";

// GET ?eventDispatchId=: what a scored decision actually did (Release 2
// result reveal). Team-scoped: the dispatch must be in the caller's session
// and targeted at the caller's team, otherwise 404. Returns null fields while
// the decision hasn't been scored yet.
export async function GET(req: NextRequest) {
  const { actor, error } = await requireTeamActor();
  if (error) return error;
  const sessionId = actor!.sessionId;
  const dispatchId = Number(req.nextUrl.searchParams.get("eventDispatchId"));
  if (!Number.isInteger(dispatchId)) return NextResponse.json({ error: "eventDispatchId is required" }, { status: 400 });

  const dispatch = await db.query.eventDispatches.findFirst({
    where: and(eq(eventDispatches.sessionId, sessionId), eq(eventDispatches.id, dispatchId)),
  });
  if (!dispatch || dispatch.targetTeamId !== actor!.teamId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const decision = await db.query.decisions.findFirst({
    where: and(eq(decisions.sessionId, sessionId), eq(decisions.eventDispatchId, dispatchId), eq(decisions.teamId, actor!.teamId!)),
  });
  const score = decision
    ? await db.query.scores.findFirst({ where: and(eq(scores.sessionId, sessionId), eq(scores.decisionId, decision.id)) })
    : null;

  return NextResponse.json({
    status: dispatch.status,
    structuredChoice: decision?.structuredChoice ?? null,
    autoFallback: decision?.actorKind === "system",
    tier: score?.tier ?? null,
    appliedDeltas: score?.appliedDeltasJson ?? null,
  });
}
