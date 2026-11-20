import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { marketRequests, teams } from "@/lib/db/schema";
import { and, eq, asc } from "drizzle-orm";
import { requireInstructorActor } from "@/lib/session-context";
import { resolveMarketRequest } from "@/lib/facilitator-actions";

// GET: pending WHO HQ purchase requests, for the instructor's approval queue.
export async function GET() {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const pending = await db.query.marketRequests.findMany({
    where: and(eq(marketRequests.sessionId, sessionId), eq(marketRequests.status, "pending")),
    orderBy: asc(marketRequests.createdAt),
  });
  const allTeams = await db.query.teams.findMany({ where: eq(teams.sessionId, sessionId) });
  return NextResponse.json({ requests: pending.map((r) => ({ ...r, regionId: allTeams.find((t) => t.id === r.teamId)?.regionId ?? "?" })) });
}

// PATCH: approve or reject a pending request. Approving requires WHO HQ to
// still have enough stock (it may have sold out to an earlier request in the
// same batch) and deducts the requesting region's fund / credits its
// resource; the "sale" is then a first-class public announcement (item 3 —
// "final sales from WHO HQ are pop-up displayed to everyone").
//
// Every balance change is an atomic single-statement conditional update
// (see lib/db-atomic.ts for why, given this app's driver can't use
// db.transaction() in production). The request row is claimed first
// (pending -> approved, guarded by status='pending' in the WHERE clause) so
// two concurrent approve clicks on the same request can't both succeed;
// if a later step then fails, the claim is compensated back to "rejected"
// rather than left in a half-applied "approved but never fulfilled" state.
export async function PATCH(req: NextRequest) {
  const { actor, error } = await requireInstructorActor();
  if (error) return error;

  const body = await req.json();
  const action = body.action === "approve" ? "approve" : "reject";
  const result = await resolveMarketRequest(actor!.sessionId, Number(body.requestId), action, actor!.userId!);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
