import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { coordinationMessages } from "@/lib/db/schema";
import { requireSession } from "@/lib/api-helpers";

// Minimum-viable inter-team coordination mechanism (05-product-requirements.md
// §6): a shared broadcast/targeted message board. All activity is visible to
// the instructor, since "did this team proactively coordinate" is itself part
// of the after-action assessment.
export async function GET() {
  const { error } = await requireSession();
  if (error) return error;
  const messages = await db.query.coordinationMessages.findMany();
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;
  if (!session!.user.teamId) {
    return NextResponse.json({ error: "Only teams can post coordination messages" }, { status: 403 });
  }

  const body = await req.json();
  const [message] = await db
    .insert(coordinationMessages)
    .values({
      fromTeamId: session!.user.teamId,
      toTeamId: body.toTeamId ?? null,
      eventDispatchId: body.eventDispatchId ?? null,
      messageText: body.messageText,
    })
    .returning();

  return NextResponse.json({ message });
}
