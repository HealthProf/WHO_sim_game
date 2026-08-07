"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PillButton } from "@/components/ui/pill-button";

interface OwnedSession {
  id: string;
  mode: "instructor" | "demo";
  status: string;
  createdAt: string;
  // Demo mode only: set when the owner is occupying a region rather than
  // acting as instructor, which decides where "Go to it" should land them.
  demoActiveRegionId: string | null;
}

const MODE_LABEL: Record<OwnedSession["mode"], string> = {
  instructor: "Class session",
  demo: "Solo demo",
};

export default function SessionsPage() {
  const router = useRouter();
  const { update } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [owned, setOwned] = useState<OwnedSession[] | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const reloadOwned = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    fetch("/api/sessions")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json) => setOwned((json.sessions ?? []).filter((s: OwnedSession) => s.status !== "archived")))
      .catch(() => setOwned([]));
  }, [reloadKey]);

  // Role is a property of session ownership (see lib/auth.ts) — force the JWT
  // to re-resolve it so requireInstructorActor() succeeds on the next page
  // load. The argument is load-bearing: next-auth's update() only POSTs to the
  // session endpoint when it has data to send. Called with no argument it
  // issues a plain GET, which Auth.js treats as a session read — the jwt
  // callback then runs without trigger === "update", the role is never
  // re-resolved, and every subsequent API call 401s.
  async function refreshRole() {
    await update({});
  }

  function landingFor(mode: OwnedSession["mode"], sessionId: string) {
    return mode === "instructor" ? `/sessions/${sessionId}/credentials` : "/control";
  }

  async function createSession(mode: "instructor" | "demo") {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(json.error ?? "Couldn't create a session.");
      reloadOwned();
      return;
    }
    await refreshRole();
    router.push(landingFor(mode, json.sessionId));
  }

  // Switching does not archive anything — both sessions stay live, and
  // whichever was activated last is the one the API routes act on (see
  // lib/session-context.ts resolveActor).
  async function switchTo(s: OwnedSession) {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/sessions/${s.id}/activate`, { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      setError("Couldn't switch to that session.");
      return;
    }
    await refreshRole();
    // In demo mode the owner may be occupying a region, in which case the
    // instructor pages would 403 — land them on the team flow instead.
    router.push(s.mode === "demo" && s.demoActiveRegionId ? "/dashboard" : "/control");
    router.refresh();
  }

  const hasMode = (mode: OwnedSession["mode"]) => (owned ?? []).some((s) => s.mode === mode);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md rounded-lg bg-bg shadow-lg p-10 space-y-6">
        <div className="text-center">
          <h1 className="font-heading text-[34px] leading-[1.1] text-text mb-2.5">Your sessions</h1>
          <p className="text-[15px] text-neutral-800 leading-[1.55]">
            You can keep one class session and one solo demo at the same time, and switch between them
            whenever you like — switching never ends the other one.
          </p>
        </div>

        {owned && owned.length > 0 && (
          <div className="space-y-2">
            {owned.map((s) => (
              <div
                key={s.id}
                className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 ${
                  s.mode === "instructor" ? "bg-accent-2-100" : "bg-surface"
                }`}
              >
                <div className="min-w-0">
                  <p
                    className={`font-heading text-[19px] ${
                      s.mode === "instructor" ? "text-accent-2-900" : "text-text"
                    }`}
                  >
                    {MODE_LABEL[s.mode]}
                  </p>
                  <p
                    className={`text-[13px] capitalize ${
                      s.mode === "instructor" ? "text-accent-2-700" : "text-neutral-700"
                    }`}
                  >
                    {s.status}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.mode === "instructor" && (
                    <a
                      href={`/sessions/${s.id}/credentials`}
                      className="inline-flex items-center justify-center rounded-full border-2 border-accent-2-400 text-accent-2-800 px-[16px] py-[7px] text-[13px] font-semibold hover:bg-accent-2-200 transition-colors"
                    >
                      Login details
                    </a>
                  )}
                  <PillButton
                    type="button"
                    onClick={() => switchTo(s)}
                    disabled={loading}
                    tone={s.mode === "instructor" ? "sage" : "accent"}
                    size="sm"
                  >
                    Go to it
                  </PillButton>
                </div>
              </div>
            ))}
          </div>
        )}

        {!hasMode("instructor") && (
          <div>
            <PillButton type="button" onClick={() => createSession("instructor")} disabled={loading} className="w-full">
              {loading ? "Creating…" : "Run a session with my class"}
            </PillButton>
            <p className="text-[13px] text-neutral-700 mt-2">
              Generates six region logins and a printable credential sheet for a real class.
            </p>
          </div>
        )}

        {!hasMode("demo") && (
          <div>
            <PillButton type="button" onClick={() => createSession("demo")} disabled={loading} tone="ghost" className="w-full">
              {loading ? "Creating…" : "Try a solo demo"}
            </PillButton>
            <p className="text-[13px] text-neutral-700 mt-2">
              Play any region or the instructor yourself — a scripted AI plays every region you&apos;re not, on a
              faster ~10-15 minute clock, so the whole arc plays out solo.
            </p>
          </div>
        )}

        {error && <p className="text-[14px] text-accent-700">{error}</p>}
      </div>
    </div>
  );
}
