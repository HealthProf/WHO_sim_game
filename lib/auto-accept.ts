// Optional auto-accept of provisional grades (Release 2, facilitator toggle,
// off by default). Each tick, any team submission older than
// AUTO_ACCEPT_GRACE_SECONDS that doesn't need review is scored with its
// rule-based provisional grade (lib/auto-grade.ts). This keeps prerequisite
// chains (lib/chain.ts) moving when the facilitator can't score in real time.
// Submissions that need review are always left for the facilitator.
//
// Runs inside the per-session throttled tick (lib/deadline.ts), and
// scores.decisionId is unique, so a decision can never be scored twice even
// if the facilitator accepts it at the same moment.
import { db } from "./db";
import { gameSessions, sessionState } from "./db/schema";
import { eq } from "drizzle-orm";
import { scoreDecision, provisionalGradeFor, pendingSubmissions } from "./score-decision";
import { AUTO_ACCEPT_GRACE_SECONDS } from "./config";

export async function runAutoAccept(sessionId: string, now: Date = new Date()): Promise<number> {
  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, sessionId) });
  if (!gs?.autoAcceptScores) return 0;
  const session = await db.query.gameSessions.findFirst({ where: eq(gameSessions.id, sessionId) });
  if (!session) return 0;

  const cutoff = now.getTime() - AUTO_ACCEPT_GRACE_SECONDS * 1000;
  // Latest submission per event only (a resubmission restarts the grace
  // period), and only real team submissions: computer players and the
  // no-response fallback are already scored by their own paths.
  const due = (await pendingSubmissions(sessionId)).filter(
    (d) => d.submittedAt.getTime() <= cutoff && (d.actorKind === "team" || d.actorKind === "owner")
  );

  let n = 0;
  for (const d of due) {
    const dispatch = await db.query.eventDispatches.findFirst({ where: (t, { and: a, eq: e }) => a(e(t.sessionId, sessionId), e(t.id, d.eventDispatchId)) });
    const event = dispatch ? await db.query.events.findFirst({ where: (t, { eq: e }) => e(t.id, dispatch.eventId) }) : null;
    if (!event) continue;
    const grade = await provisionalGradeFor(sessionId, d, event);
    if (grade.needsReview) continue;
    try {
      await scoreDecision(sessionId, { decisionId: d.id, acceptProvisional: true, overrideReason: "Auto-accepted provisional grade" }, session.ownerUserId);
      n++;
    } catch {
      // Already scored by someone else in the meantime; nothing to do.
    }
  }
  return n;
}
