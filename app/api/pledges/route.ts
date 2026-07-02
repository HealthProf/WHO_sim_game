import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resourcePledges, teams, modelState, modelStateHistory, teamNotifications } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/api-helpers";
import { clamp } from "@/lib/model-engine";

// Resource pledge ledger (see 07-open-questions.md's original discussion of
// coordination mechanisms, and lib/db/schema.ts's resourcePledges table):
// turns "we'll share PPE/funds/HCW capacity" from a narrative-only rationale
// line into an actual transfer between two regions' live resource fields.
// Visible to everyone, same transparency model as the coordination log.

const FIELD_BY_RESOURCE = {
  FUND: "fundRemaining",
  PPE_DAYS: "ppeDaysRemaining",
  ANTIVIRALS: "antiviralsRemaining",
  HCW_SURGE_PCT: "hcwSurgePct",
} as const;

const LABEL_BY_RESOURCE: Record<string, string> = {
  FUND: "$",
  PPE_DAYS: " PPE-days",
  ANTIVIRALS: " antiviral doses",
  HCW_SURGE_PCT: "% HCW surge capacity",
};

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const allPledges = await db.query.resourcePledges.findMany({ orderBy: (t, { desc }) => [desc(t.createdAt)] });
  const allTeams = await db.query.teams.findMany();
  const enriched = allPledges.map((p) => ({
    ...p,
    fromRegionId: allTeams.find((t) => t.id === p.fromTeamId)?.regionId ?? "?",
    toRegionId: allTeams.find((t) => t.id === p.toTeamId)?.regionId ?? "?",
  }));

  return NextResponse.json({ pledges: enriched });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (session!.user.role !== "student" || !session!.user.teamId) {
    return NextResponse.json({ error: "Only teams can pledge resources" }, { status: 403 });
  }

  const body = await req.json();
  const toRegionId = body.toRegionId as string;
  const resourceType = body.resourceType as keyof typeof FIELD_BY_RESOURCE;
  const amount = Math.round(Number(body.amount));

  if (!FIELD_BY_RESOURCE[resourceType]) {
    return NextResponse.json({ error: "Invalid resource type" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }
  if (toRegionId === session!.user.regionId) {
    return NextResponse.json({ error: "Can't pledge resources to your own region" }, { status: 400 });
  }

  const fromTeam = await db.query.teams.findFirst({ where: eq(teams.id, session!.user.teamId) });
  const toTeam = await db.query.teams.findFirst({ where: eq(teams.regionId, toRegionId) });
  if (!fromTeam || !toTeam) return NextResponse.json({ error: "Region not found" }, { status: 404 });

  const field = FIELD_BY_RESOURCE[resourceType];
  const fromState = await db.query.modelState.findFirst({ where: eq(modelState.regionId, fromTeam.regionId) });
  const toState = await db.query.modelState.findFirst({ where: eq(modelState.regionId, toTeam.regionId) });
  if (!fromState || !toState) return NextResponse.json({ error: "Model state not found" }, { status: 404 });

  const currentAmount = fromState[field] as number;
  if (currentAmount < amount) {
    return NextResponse.json({ error: `${fromTeam.regionId} only has ${currentAmount}${LABEL_BY_RESOURCE[resourceType]} available` }, { status: 400 });
  }

  const nextFrom = currentAmount - amount;
  const nextTo = resourceType === "HCW_SURGE_PCT" ? clamp((toState[field] as number) + amount, 0, 100) : (toState[field] as number) + amount;

  await db.update(modelState).set({ [field]: nextFrom, updatedAt: new Date() }).where(eq(modelState.regionId, fromTeam.regionId));
  await db.update(modelState).set({ [field]: nextTo, updatedAt: new Date() }).where(eq(modelState.regionId, toTeam.regionId));

  const reason = `Pledge: ${amount}${LABEL_BY_RESOURCE[resourceType]} from ${fromTeam.regionId} to ${toTeam.regionId}`;
  const [updatedFrom, updatedTo] = await Promise.all([
    db.query.modelState.findFirst({ where: eq(modelState.regionId, fromTeam.regionId) }),
    db.query.modelState.findFirst({ where: eq(modelState.regionId, toTeam.regionId) }),
  ]);
  if (updatedFrom) await db.insert(modelStateHistory).values({ regionId: fromTeam.regionId, day: updatedFrom.day, snapshotJson: updatedFrom, reason });
  if (updatedTo) await db.insert(modelStateHistory).values({ regionId: toTeam.regionId, day: updatedTo.day, snapshotJson: updatedTo, reason });

  const [pledge] = await db
    .insert(resourcePledges)
    .values({
      fromTeamId: fromTeam.id,
      toTeamId: toTeam.id,
      resourceType,
      amount,
      eventDispatchId: body.eventDispatchId ?? null,
      createdByUserId: Number(session!.user.id),
    })
    .returning();

  await db.insert(teamNotifications).values({
    teamId: toTeam.id,
    kind: "pledge",
    message: `${fromTeam.regionId} pledged you ${amount}${LABEL_BY_RESOURCE[resourceType]}.`,
  });

  return NextResponse.json({ pledge });
}
