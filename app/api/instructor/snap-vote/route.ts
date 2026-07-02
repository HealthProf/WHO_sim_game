import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { instructorActions } from "@/lib/db/schema";
import { requireInstructor } from "@/lib/api-helpers";
import { createSnapVote, closeSnapVote, getSnapVoteState } from "@/lib/snap-vote";

// POST: instructor calls a new snap vote ("break-glass" Emergency Committee
// tool — see lib/snap-vote.ts). Any still-open vote is superseded/closed
// first, since only one can be live at a time.
export async function POST(req: NextRequest) {
  const { session, error } = await requireInstructor();
  if (error) return error;

  const body = await req.json();
  const question = (body.question as string)?.trim();
  if (!question) return NextResponse.json({ error: "A question is required" }, { status: 400 });

  const options: string[] = Array.isArray(body.options) && body.options.length >= 2 ? body.options : ["YES", "NO"];
  const durationSeconds = Number(body.durationSeconds) > 0 ? Number(body.durationSeconds) : 90;

  const vote = await createSnapVote({
    question,
    options,
    durationSeconds,
    createdByUserId: Number(session!.user.id),
  });

  await db.insert(instructorActions).values({
    instructorUserId: Number(session!.user.id),
    actionType: "snap_vote_called",
    targetDesc: `"${question}" (${durationSeconds}s, options: ${options.join("/")})`,
  });

  return NextResponse.json({ vote });
}

// PATCH: instructor closes/tallies the current open vote early.
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireInstructor();
  if (error) return error;

  const body = await req.json();
  const snapVoteId = body.snapVoteId as number;

  const result = await closeSnapVote(snapVoteId);
  if (!result) return NextResponse.json({ error: "Vote not found or already closed" }, { status: 404 });

  await db.insert(instructorActions).values({
    instructorUserId: Number(session!.user.id),
    actionType: "snap_vote_closed_early",
    targetDesc: `"${result.vote.question}" — ${result.summary}`,
  });

  return NextResponse.json({ result });
}

// GET: instructor-side view with the live breakdown (see /api/snap-vote for
// the team-facing equivalent, which redacts the breakdown while a vote is
// still open).
export async function GET() {
  const { error } = await requireInstructor();
  if (error) return error;
  const state = await getSnapVoteState({ forInstructor: true });
  return NextResponse.json(state);
}
