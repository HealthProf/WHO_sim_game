import { NextResponse } from "next/server";
import { requireActor } from "@/lib/session-context";
import { buildSessionHistory, historyForTeam } from "@/lib/history";

// GET: the caller's session's time series for the line charts (Release 4).
// The facilitator gets every region in full; a team gets its own region in
// full plus other regions' public metrics (lib/history.ts historyForTeam).
export async function GET() {
  const { actor, error } = await requireActor();
  if (error) return error;
  const h = await buildSessionHistory(actor!.sessionId);
  return NextResponse.json(actor!.role === "instructor" || !actor!.regionId ? h : historyForTeam(h, actor!.regionId));
}
