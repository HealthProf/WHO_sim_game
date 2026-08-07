import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/lib/session-context";
import { handleCheatAttempt } from "@/lib/cheat-engine";

// POST { raw: string } — raw is the exact text typed into the cheat code
// entry box (letters/digits plus the arrow glyphs the box inserts on
// arrow-key presses — see components/cheat-code-widget.tsx). A wrong guess
// and a real code the actor's role can't use both come back as the same
// { result: "fail" }, so nothing about *why* an entry failed is ever
// discoverable by probing this route.
export async function POST(req: NextRequest) {
  const { actor, error } = await requireActor();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  const raw = typeof body.raw === "string" ? body.raw : "";

  const result = await handleCheatAttempt(actor!.sessionId, actor!, raw);
  return NextResponse.json(result);
}
