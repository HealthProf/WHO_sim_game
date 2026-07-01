import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decisions, eventDispatches, events } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/api-helpers";

// POST: a team submits a decision for a dispatch targeted at them. Allows
// resubmission before the deadline (per 05-product-requirements.md §3) —
// each submission is a new row, so full revision history is retained rather
// than overwritten.
export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (session!.user.role !== "student" || !session!.user.teamId) {
    return NextResponse.json({ error: "Only teams can submit decisions" }, { status: 403 });
  }

  const body = await req.json();
  const eventDispatchId = body.eventDispatchId as number;

  const dispatch = await db.query.eventDispatches.findFirst({ where: eq(eventDispatches.id, eventDispatchId) });
  if (!dispatch) return NextResponse.json({ error: "Dispatch not found" }, { status: 404 });
  if (dispatch.targetTeamId !== session!.user.teamId) {
    return NextResponse.json({ error: "This event is not targeted at your team" }, { status: 403 });
  }
  if (dispatch.status === "scored" || dispatch.status === "closed") {
    return NextResponse.json({ error: "This event has already been scored and closed" }, { status: 409 });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, dispatch.eventId) });
  const rationaleText = (body.rationaleText as string) ?? "";

  if (event?.isAllocationEvent) {
    const allocation = body.resourceAllocationJson as Record<string, number> | undefined;
    const total = Object.values(allocation ?? {}).reduce((a, b) => a + b, 0);
    if (!allocation || total !== 180000) {
      return NextResponse.json({ error: `Allocation must sum to exactly 180,000 doses (currently ${total}).` }, { status: 400 });
    }
  }

  const [decision] = await db
    .insert(decisions)
    .values({
      eventDispatchId,
      teamId: session!.user.teamId,
      submittedByUserId: Number(session!.user.id),
      structuredChoice: body.structuredChoice ?? null,
      rationaleText,
      resourceAllocationJson: body.resourceAllocationJson ?? null,
      coordinatedWithTeamsJson: body.coordinatedWithTeamsJson ?? null,
    })
    .returning();

  await db.update(eventDispatches).set({ status: "responded" }).where(eq(eventDispatches.id, eventDispatchId));

  return NextResponse.json({ decision });
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const dispatchId = searchParams.get("eventDispatchId");

  if (dispatchId) {
    const rows = await db.query.decisions.findMany({ where: eq(decisions.eventDispatchId, Number(dispatchId)) });
    return NextResponse.json({ decisions: rows });
  }

  if (session!.user.role === "instructor") {
    const rows = await db.query.decisions.findMany();
    return NextResponse.json({ decisions: rows });
  }

  const rows = await db.query.decisions.findMany({ where: eq(decisions.teamId, session!.user.teamId!) });
  return NextResponse.json({ decisions: rows });
}
