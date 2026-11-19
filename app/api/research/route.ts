import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessionState } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireActor, requireTeamActor } from "@/lib/session-context";
import { RD_MILESTONES, contributeToResearch, productFor } from "@/lib/research";
import { lockedResponse } from "@/lib/feature-gate";
import { logAnalyticsEvent } from "@/lib/analytics";

// Shared R&D fund (Release 5, lib/research.ts). Contributions are public
// (like pledges), so every actor in the session sees the same state.
export async function GET() {
  const { actor, error } = await requireActor();
  if (error) return error;
  const gs = await db.query.sessionState.findFirst({ where: eq(sessionState.sessionId, actor!.sessionId) });
  return NextResponse.json({
    fund: gs?.rdFund ?? 0,
    milestone: gs?.rdMilestone ?? 0,
    contributions: gs?.rdContributions ?? {},
    milestones: RD_MILESTONES.map(({ level, fund, name, effect }) => ({ level, fund, name, effect })),
    product: productFor(gs?.pathogenId),
  });
}

// POST { amount }: a team contributes from its own fund. Opens with
// Pledges & Funding in the phased unlock.
export async function POST(req: NextRequest) {
  const { actor, error } = await requireTeamActor();
  if (error) return error;
  const locked = await lockedResponse(actor!.sessionId, "pledges", actor!.role);
  if (locked) return locked;
  const body = await req.json().catch(() => ({}));
  const result = await contributeToResearch(actor!.sessionId, actor!.regionId!, Math.round(Number(body.amount)));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  await logAnalyticsEvent({
    sessionId: actor!.sessionId,
    mode: actor!.mode,
    eventType: "research_contributed",
    actorRole: actor!.role,
    regionId: actor!.regionId,
    userId: actor!.userId,
    metadata: { amount: Math.round(Number(body.amount)) },
  });
  return NextResponse.json({ ok: true, fund: result.fund, newMilestones: result.newMilestones.map((m) => m.name) });
}
