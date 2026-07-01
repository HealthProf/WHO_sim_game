import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireInstructor } from "@/lib/api-helpers";

export async function GET() {
  const { error } = await requireInstructor();
  if (error) return error;
  const log = await db.query.instructorActions.findMany({
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  return NextResponse.json({ log });
}
