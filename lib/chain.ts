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

// Batched form of canDispatch for the Control/events list, which needs
// every event's chain status on every poll — computed from 2 total queries
// (every chain link, every dispatch) instead of canDispatch's 2 queries
// PER event.
export async function computeAllChainStatus(eventIds: string[]): Promise<Record<string, { ok: boolean; blockedBy: string[] }>> {
  const allLinks = await db.query.eventChainLinks.findMany();
  const allDispatches = await db.query.eventDispatches.findMany();

  const result: Record<string, { ok: boolean; blockedBy: string[] }> = {};
  for (const eventId of eventIds) {
    const links = allLinks.filter((l) => l.nextEventId === eventId);
    const blockedBy: string[] = [];
    for (const link of links) {
      const dispatchesForPrev = allDispatches.filter((d) => d.eventId === link.prevEventId);
      if (dispatchesForPrev.length === 0) {
        blockedBy.push(link.prevEventId);
        continue;
      }
      const allResolved = dispatchesForPrev.every((d) => d.status === "scored" || d.status === "closed");
      if (!allResolved) blockedBy.push(link.prevEventId);
    }
    result[eventId] = { ok: blockedBy.length === 0, blockedBy };
  }
  return result;
}
