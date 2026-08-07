import { ownedActiveSession } from "@/lib/session-context";
import { InstructorRail } from "@/components/instructor-rail";

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const active = await ownedActiveSession();
  const demoSession = active?.mode === "demo" ? active : null;

  return (
    <div className="flex min-h-screen flex-col bg-bg text-text lg:flex-row">
      <InstructorRail demoSession={demoSession} active={active} />
      <main className="flex min-w-0 flex-1 flex-col gap-[26px] bg-bg px-[22px] py-[26px] lg:px-[34px] lg:py-[30px]">{children}</main>
    </div>
  );
}
