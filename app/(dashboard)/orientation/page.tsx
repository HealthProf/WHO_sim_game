import { redirect } from "next/navigation";

// Orientation, Profile, and Glossary merged into a single tabbed Briefing
// page (see app/(dashboard)/briefing/page.tsx) — this route stays live as a
// redirect so old links/bookmarks keep working. /orientation/slides is
// unaffected and still lives under this route segment.
export default function OrientationRedirect() {
  redirect("/briefing");
}
