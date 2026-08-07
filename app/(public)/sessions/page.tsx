"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function SessionsPage() {
  const router = useRouter();
  const { update } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      return;
    }
    // Role is a property of session ownership (see lib/auth.ts) — force the
    // JWT to re-resolve it now that this account owns a session, so
    // requireInstructorActor() on the next page load succeeds immediately.
    //
    // The argument is load-bearing: next-auth's update() only POSTs to the
    // session endpoint when it has data to send (see its useSession update
    // implementation). Called with no argument it issues a plain GET, which
    // Auth.js treats as a session read — the jwt callback then runs without
    // trigger === "update", the role is never re-resolved, and every
    // subsequent API call 401s.
    await update({});
    if (mode === "instructor") {
      router.push(`/sessions/${json.sessionId}/credentials`);
    } else {
      router.push("/control");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 mb-2">Start a session</h1>
          <p className="text-sm text-slate-400">Two ways to run Operation Veiled Horizon:</p>
        </div>
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
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
