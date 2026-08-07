import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/lib/session-context";
import { executeCheatCode } from "@/lib/cheat-engine";
import { CHEAT_CODES, type CheatCodeKey } from "@/lib/cheat-codes";

// POST { codeKey: string } — called by the client after its own 5s
// success-screen countdown finishes (see the task spec: "code should
// execute 5 seconds after this screen appears"). Re-validated server-side
// against the known code list and the actor's role rather than trusting the
// client's earlier /attempt result.
export async function POST(req: NextRequest) {
  const { actor, error } = await requireActor();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const codeKey = body.codeKey as string | undefined;
  if (!codeKey || !CHEAT_CODES.some((c) => c.key === codeKey)) {
    return NextResponse.json({ error: "Unknown code" }, { status: 400 });
  }

  await executeCheatCode(actor!.sessionId, actor!, codeKey as CheatCodeKey);
  return NextResponse.json({ ok: true });
}
