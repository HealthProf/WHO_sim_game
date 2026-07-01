import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { modelState, modelStateHistory, instructorActions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireInstructor } from "@/lib/api-helpers";
import { recomputeEscalationState } from "@/lib/model-engine";

// PATCH: instructor manual override panel — directly edit any region's live
// model state (05-product-requirements.md §8). Requires a reason for the
// audit trail.
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireInstructor();
  if (error) return error;

  const body = await req.json();
  const regionId = body.regionId as string;
  const fields = body.fields as Record<string, number>;
  const reason = body.reason as string;

  if (!reason) return NextResponse.json({ error: "A reason is required for manual overrides." }, { status: 400 });

  const before = await db.query.modelState.findFirst({ where: eq(modelState.regionId, regionId) });
  if (!before) return NextResponse.json({ error: "Region not found" }, { status: 404 });

  await db.update(modelState).set({ ...fields, updatedAt: new Date() }).where(eq(modelState.regionId, regionId));

  const after = await db.query.modelState.findFirst({ where: eq(modelState.regionId, regionId) });
  await db.insert(modelStateHistory).values({
    regionId,
    day: after!.day,
    snapshotJson: after,
    reason: `Manual override by instructor: ${reason}`,
  });

  await db.insert(instructorActions).values({
    instructorUserId: Number(session!.user.id),
    actionType: "edit_model_state",
    targetDesc: `${regionId}: ${Object.keys(fields).join(", ")}`,
    reason,
  });

  await recomputeEscalationState();

  return NextResponse.json({ modelState: after });
}
