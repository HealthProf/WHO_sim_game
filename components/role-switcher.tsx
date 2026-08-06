"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { REGIONS } from "@/lib/regions";

// Demo mode only — lets the session owner switch which region they're
// occupying (or step back to instructor) without re-authenticating.
// gameSessions.demoActiveRegionId is the server-side source of truth (see
// lib/session-context.ts requireActor()); this just PATCHes it and
// navigates to the page that matches the new role.
export function RoleSwitcher({ sessionId, currentRegionId }: { sessionId: string; currentRegionId: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function switchTo(regionId: string | null) {
    setPending(true);
    const res = await fetch(`/api/sessions/${sessionId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regionId }),
    });
    setPending(false);
    if (!res.ok) return;
    router.push(regionId ? "/dashboard" : "/control");
    router.refresh();
  }

  return (
    <select
      value={currentRegionId ?? "INSTRUCTOR"}
      disabled={pending}
      onChange={(e) => switchTo(e.target.value === "INSTRUCTOR" ? null : e.target.value)}
      className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-xs text-slate-200"
      title="Demo mode: switch which role you're playing"
    >
      <option value="INSTRUCTOR">Playing: Instructor</option>
      {REGIONS.map((r) => (
        <option key={r} value={r}>
          Playing: {r}
        </option>
      ))}
    </select>
  );
}
