import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  // A region login always lands in the team flow. A public account (kind
  // "user") only has "instructor" role once it owns an active game session
  // (see lib/auth.ts resolveUserRole) — otherwise it hasn't created one yet.
  if (session.user.kind === "region") redirect("/briefing");
  if (session.user.role === "instructor") redirect("/guide");
  redirect("/sessions");
}
