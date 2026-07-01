import { SignOutButton } from "@/components/signout-button";
import { HeaderClock } from "@/components/header-clock";
import Link from "next/link";

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Operation Veiled Horizon</p>
          <h1 className="text-lg font-semibold">Facilitator Console</h1>
        </div>
        <HeaderClock />
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/control" className="text-slate-300 hover:text-white">Command Center</Link>
          <Link href="/scoring" className="text-slate-300 hover:text-white">Scoring Inbox</Link>
          <Link href="/model" className="text-slate-300 hover:text-white">Model Override</Link>
          <Link href="/debrief" className="text-slate-300 hover:text-white">Debrief</Link>
          <Link href="/log" className="text-slate-300 hover:text-white">Action Log</Link>
          <Link href="/guide" className="text-slate-300 hover:text-white">Guide</Link>
          <SignOutButton />
        </nav>
      </header>
      <main className="p-6 max-w-7xl mx-auto">{children}</main>
    </div>
  );
}
