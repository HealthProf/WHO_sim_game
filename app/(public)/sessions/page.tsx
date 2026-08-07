"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

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
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-10">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-100 mb-2">Your sessions</h1>
          <p className="text-sm text-slate-400">
            You can keep one class session and one solo demo at the same time, and switch between them
            whenever you like — switching never ends the other one.
          </p>
        </div>

        {owned && owned.length > 0 && (
          <div className="space-y-2">
            {owned.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-md border border-slate-700 bg-slate-800/60 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-slate-100">{MODE_LABEL[s.mode]}</p>
                  <p className="text-xs text-slate-500 capitalize">{s.status}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.mode === "instructor" && (
                    <a
                      href={`/sessions/${s.id}/credentials`}
                      className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:bg-slate-700"
                    >
                      Login details
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => switchTo(s)}
                    disabled={loading}
                    className="rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1 text-xs font-medium text-white"
                  >
                    Go to it
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!hasMode("instructor") && (
          <div>
            <button
              type="button"
              onClick={() => createSession("instructor")}
              disabled={loading}
              className="w-full rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2 transition"
            >
              {loading ? "Creating…" : "Run a session with my class"}
            </button>
            <p className="text-xs text-slate-500 mt-2">
              Generates six region logins and a printable credential sheet for a real class.
            </p>
          </div>
        )}

        {!hasMode("demo") && (
          <div>
            <button
              type="button"
              onClick={() => createSession("demo")}
              disabled={loading}
              className="w-full rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-medium py-2 transition"
            >
              {loading ? "Creating…" : "Try a solo demo"}
            </button>
            <p className="text-xs text-slate-500 mt-2">
              Play any region or the instructor yourself — a scripted AI plays every region you&apos;re not, on a
              faster ~10-15 minute clock, so the whole arc plays out solo.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
