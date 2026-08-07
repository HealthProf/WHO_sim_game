import { auth } from "@/lib/auth";
import { ownedActiveSession } from "@/lib/session-context";
import { TeamAnnouncementWatcher } from "@/components/team-announcement-watcher";
import { TeamRail } from "@/components/team-rail";
import { CheatCodeWidget } from "@/components/cheat-code-widget";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const active = await ownedActiveSession();
  const demoSession = active?.mode === "demo" ? active : null;

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text lg:flex-row">
      <TeamAnnouncementWatcher />
      <CheatCodeWidget />
      <TeamRail
        regionId={session?.user?.regionId}
        demoSession={demoSession}
        isAccountHolder={session?.user?.kind === "user"}
      />
      <main className="flex min-w-0 flex-1 flex-col gap-[26px] bg-bg px-[22px] py-[26px] lg:px-[34px] lg:py-[30px]">{children}</main>
    </div>
  );
}
