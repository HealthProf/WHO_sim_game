import { redirect } from "next/navigation";

// Merged into the Briefing page's "Glossary" tab — see
// app/(dashboard)/briefing/page.tsx. Kept as a redirect for old links.
export default function GlossaryRedirect() {
  redirect("/briefing");
}
