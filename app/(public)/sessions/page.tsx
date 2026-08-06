"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function SessionsPage() {
  const router = useRouter();
  const { update } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createInstructorSession() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "instructor" }),
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
    await update();
    router.push(`/sessions/${json.sessionId}/credentials`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-100 mb-2">Start a session</h1>
        <p className="text-sm text-slate-400 mb-6">
          Running a session with a class generates six region logins and a printable credential sheet — you&apos;ll
          land on the instructor Command Center once it&apos;s ready.
        </p>
        <button
          type="button"
          onClick={createInstructorSession}
          disabled={loading}
          className="w-full rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2 transition"
        >
          {loading ? "Creating…" : "Run a session with my class"}
        </button>
        {error && <p className="text-sm text-red-400 mt-4">{error}</p>}
      </div>
    </div>
  );
}
