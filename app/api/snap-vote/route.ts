import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { snapVotes, snapVoteResponses } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { requireActor, requireTeamActor } from "@/lib/session-context";
import { getSnapVoteState, closeExpiredSnapVotes } from "@/lib/snap-vote";
import { logAnalyticsEvent } from "@/lib/analytics";

// GET: any authenticated user can see the current open vote (teams see only
// response counts while it's open; the instructor sees the live breakdown —
// see lib/snap-vote.ts) plus recent history.
export async function GET() {
  const { actor, error } = await requireActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  await closeExpiredSnapVotes(sessionId).catch(() => {});

  const state = await getSnapVoteState(sessionId, {
    forInstructor: actor!.role === "instructor",
    teamId: actor!.teamId,
  });
  return NextResponse.json(state);
}

// POST: a team submits its choice on the current open vote.
export async function POST(req: NextRequest) {
  const { actor, error } = await requireTeamActor();
  if (error) return error;
  const sessionId = actor!.sessionId;

  const body = await req.json();
  const snapVoteId = body.snapVoteId as number;
  const choice = body.choice as string;

  const vote = await db.query.snapVotes.findFirst({ where: and(eq(snapVotes.sessionId, sessionId), eq(snapVotes.id, snapVoteId)) });
  if (!vote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (vote.status !== "open" || new Date(vote.closesAt) <= new Date()) {
    return NextResponse.json({ error: "This vote is no longer open" }, { status: 409 });
  }
  const options = vote.optionsJson as string[];
  if (!options.includes(choice)) {
    return NextResponse.json({ error: "Not a valid option for this vote" }, { status: 400 });
  }

  const existing = await db.query.snapVoteResponses.findFirst({
    where: and(eq(snapVoteResponses.sessionId, sessionId), eq(snapVoteResponses.snapVoteId, snapVoteId), eq(snapVoteResponses.teamId, actor!.teamId!)),
  });
  if (existing) {
    return NextResponse.json({ error: "Your team has already voted on this" }, { status: 409 });
  }

  const [response] = await db
    .insert(snapVoteResponses)
    .values({ sessionId, snapVoteId, teamId: actor!.teamId!, choice })
    .returning();

  await logAnalyticsEvent({
    sessionId,
    mode: actor!.mode,
    eventType: "snap_vote_responded",
    actorRole: actor!.role,
    regionId: actor!.regionId,
    userId: actor!.userId,
    metadata: { snapVoteId, choice },
  });

  return NextResponse.json({ response });
}
