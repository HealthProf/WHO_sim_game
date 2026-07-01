import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/signout-button";
import Link from "next/link";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Operation Veiled Horizon</p>
          <h1 className="text-lg font-semibold">{session?.user?.regionId} Regional Office</h1>
        </div>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-slate-300 hover:text-white">Situation Room</Link>
          <Link href="/events" className="text-slate-300 hover:text-white">Events</Link>
          <Link href="/coordination" className="text-slate-300 hover:text-white">Coordination</Link>
          <Link href="/profile" className="text-slate-300 hover:text-white">Profile</Link>
          <SignOutButton />
        </nav>
      </header>
      <main className="p-6 max-w-6xl mx-auto">{children}</main>
    </div>
  );
}
