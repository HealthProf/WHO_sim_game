import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { instructorActions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireInstructorActor } from "@/lib/session-context";

export async function GET() {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const log = await db.query.instructorActions.findMany({
    where: eq(instructorActions.sessionId, actor!.sessionId),
    orderBy: desc(instructorActions.createdAt),
  });
  return NextResponse.json({ log });
}
