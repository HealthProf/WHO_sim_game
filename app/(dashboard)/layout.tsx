import { auth } from "@/lib/auth";
import { ownedActiveSession } from "@/lib/session-context";
import { SignOutButton } from "@/components/signout-button";
import { HeaderClock } from "@/components/header-clock";
import { TeamAnnouncementWatcher } from "@/components/team-announcement-watcher";
import { RoleSwitcher } from "@/components/role-switcher";
import Link from "next/link";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const active = await ownedActiveSession();
  const demoSession = active?.mode === "demo" ? active : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <TeamAnnouncementWatcher />
      <header className="border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Operation Veiled Horizon</p>
          <h1 className="text-lg font-semibold">{session?.user?.regionId} Regional Office</h1>
        </div>
        {demoSession && <RoleSwitcher sessionId={demoSession.sessionId} currentRegionId={demoSession.demoActiveRegionId} />}
        <HeaderClock />
      </header>
      <nav className="flex items-center gap-4 text-sm overflow-x-auto whitespace-nowrap border-b border-slate-800 px-6 py-3 [-webkit-overflow-scrolling:touch]">
        <Link href="/orientation" className="text-slate-300 hover:text-white shrink-0">Orientation</Link>
        <Link href="/dashboard" className="text-slate-300 hover:text-white shrink-0">Situation Room</Link>
        <Link href="/events" className="text-slate-300 hover:text-white shrink-0">Events</Link>
        <Link href="/coordination" className="text-slate-300 hover:text-white shrink-0">Coordination</Link>
        <Link href="/pledges" className="text-slate-300 hover:text-white shrink-0">Pledges</Link>
        <Link href="/marketplace" className="text-slate-300 hover:text-white shrink-0">Marketplace</Link>
        <Link href="/emergency-funding" className="text-slate-300 hover:text-white shrink-0">Emergency Funding</Link>
        <Link href="/profile" className="text-slate-300 hover:text-white shrink-0">Profile</Link>
        <Link href="/summary" className="text-slate-300 hover:text-white shrink-0">Summary Report</Link>
        <Link href="/glossary" className="text-slate-300 hover:text-white shrink-0">Glossary</Link>
        <SignOutButton />
      </nav>
      <main className="p-6 max-w-6xl mx-auto">{children}</main>
    </div>
  );
}
