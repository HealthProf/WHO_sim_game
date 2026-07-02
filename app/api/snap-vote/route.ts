import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { snapVotes, snapVoteResponses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/api-helpers";
import { getSnapVoteState, closeExpiredSnapVotes } from "@/lib/snap-vote";

// GET: any authenticated user can see the current open vote (teams see only
// response counts while it's open; the instructor sees the live breakdown —
// see lib/snap-vote.ts) plus recent history.
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  await closeExpiredSnapVotes().catch(() => {});

  const state = await getSnapVoteState({
    forInstructor: session!.user.role === "instructor",
    teamId: session!.user.teamId,
  });
  return NextResponse.json(state);
}

// POST: a team submits its choice on the current open vote.
export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (session!.user.role !== "student" || !session!.user.teamId) {
    return NextResponse.json({ error: "Only teams can vote" }, { status: 403 });
  }

  const body = await req.json();
  const snapVoteId = body.snapVoteId as number;
  const choice = body.choice as string;

  const vote = await db.query.snapVotes.findFirst({ where: eq(snapVotes.id, snapVoteId) });
  if (!vote || vote.status !== "open" || new Date(vote.closesAt) <= new Date()) {
    return NextResponse.json({ error: "This vote is no longer open" }, { status: 409 });
  }
  const options = vote.optionsJson as string[];
  if (!options.includes(choice)) {
    return NextResponse.json({ error: "Not a valid option for this vote" }, { status: 400 });
  }

  const existing = await db.query.snapVoteResponses.findFirst({
    where: (t, { and, eq }) => and(eq(t.snapVoteId, snapVoteId), eq(t.teamId, session!.user.teamId!)),
  });
  if (existing) {
    return NextResponse.json({ error: "Your team has already voted on this" }, { status: 409 });
  }

  const [response] = await db
    .insert(snapVoteResponses)
    .values({ snapVoteId, teamId: session!.user.teamId, choice })
    .returning();

  return NextResponse.json({ response });
}
