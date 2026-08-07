import { ownedActiveSession } from "@/lib/session-context";
import { SignOutButton } from "@/components/signout-button";
import { HeaderClock } from "@/components/header-clock";
import { ResetSimulationButton } from "@/components/reset-simulation-button";
import { RoleSwitcher } from "@/components/role-switcher";
import { OpenDisplayButton } from "@/components/open-display-button";
import Link from "next/link";

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const active = await ownedActiveSession();
  const demoSession = active?.mode === "demo" ? active : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Operation Veiled Horizon</p>
          <h1 className="text-lg font-semibold">Facilitator Console</h1>
        </div>
        {demoSession && <RoleSwitcher sessionId={demoSession.sessionId} currentRegionId={demoSession.demoActiveRegionId} />}
        <HeaderClock />
      </header>
      <nav className="flex items-center gap-4 text-sm overflow-x-auto whitespace-nowrap border-b border-slate-800 px-6 py-3 [-webkit-overflow-scrolling:touch]">
        <Link href="/control" className="text-slate-300 hover:text-white shrink-0">Command Center</Link>
        <Link href="/global" className="text-slate-300 hover:text-white shrink-0">Global View</Link>
        <Link href="/scoring" className="text-slate-300 hover:text-white shrink-0">Scoring Inbox</Link>
        <Link href="/debrief" className="text-slate-300 hover:text-white shrink-0">Debrief</Link>
        <Link href="/log" className="text-slate-300 hover:text-white shrink-0">Action Log</Link>
        <Link href="/guide" className="text-slate-300 hover:text-white shrink-0">Guide</Link>
        {/* Instructor mode only — demo sessions have no region logins at all
            (see lib/session-lifecycle.ts createSession), so there is no
            credential sheet to re-show. */}
        {active?.mode === "instructor" && (
          <Link href={`/sessions/${active.sessionId}/credentials`} className="text-slate-300 hover:text-white shrink-0">
            Login Details
          </Link>
        )}
        <Link href="/sessions" className="text-slate-300 hover:text-white shrink-0">Switch Mode</Link>
        {active && <OpenDisplayButton displayToken={active.displayToken} label="Projector" />}
        <SignOutButton />
        <ResetSimulationButton />
      </nav>
      <main className="p-6 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
