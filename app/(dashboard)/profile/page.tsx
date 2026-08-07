import { redirect } from "next/navigation";

// Merged into the Briefing page's "Your region" tab — see
// app/(dashboard)/briefing/page.tsx. Kept as a redirect for old links.
export default function ProfileRedirect() {
  redirect("/briefing");
}
