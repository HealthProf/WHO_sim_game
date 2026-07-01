// Chain integrity enforcement per simulation-docs/05-product-requirements.md
// §7: an event with prerequisite events must not be dispatchable (even
// manually) until every prerequisite has been fully resolved for every team
// it targeted (all target teams have a scored submission, or the deadline
// passed and an auto-consequence was applied — either way ends in status
// "scored" or "closed").

import { db } from "./db";
import { eventChainLinks, eventDispatches } from "./db/schema";
import { eq } from "drizzle-orm";

export async function getUnresolvedPrerequisites(eventId: string): Promise<string[]> {
  const links = await db.query.eventChainLinks.findMany({ where: eq(eventChainLinks.nextEventId, eventId) });
  if (links.length === 0) return [];

  const unresolved: string[] = [];
  for (const link of links) {
    const dispatches = await db.query.eventDispatches.findMany({ where: eq(eventDispatches.eventId, link.prevEventId) });
    if (dispatches.length === 0) {
      // prerequisite has never even been dispatched
      unresolved.push(link.prevEventId);
      continue;
    }
    const allResolved = dispatches.every((d) => d.status === "scored" || d.status === "closed");
    if (!allResolved) unresolved.push(link.prevEventId);
  }
  return unresolved;
}

export async function canDispatch(eventId: string): Promise<{ ok: boolean; blockedBy: string[] }> {
  const blockedBy = await getUnresolvedPrerequisites(eventId);
  return { ok: blockedBy.length === 0, blockedBy };
}
