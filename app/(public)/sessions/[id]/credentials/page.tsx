"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { QrCode } from "@/components/qr-code";

interface Credential {
  regionId: string;
  username: string;
  password: string | null;
}

export default function SessionCredentialsPage() {
  const params = useParams<{ id: string }>();
  const [credentials, setCredentials] = useState<Credential[] | null>(null);
  const [displayToken, setDisplayToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sessions/${params.id}/credentials`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json) => {
        setCredentials(json.credentials);
        setDisplayToken(json.session.displayToken);
      })
      .catch(() => setError("Couldn't load this session's credentials."));
  }, [params.id]);

  if (error) return <div className="max-w-2xl mx-auto p-8 text-sm text-red-400">{error}</div>;
  if (!credentials) return <div className="max-w-2xl mx-auto p-8 text-sm text-slate-400">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto p-8 print:text-black">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h1 className="text-xl font-semibold text-slate-100">Session credentials</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
          >
            Print
          </button>
          <a
            href="/control"
            className="rounded-md bg-blue-600 hover:bg-blue-500 px-3 py-2 text-sm text-white font-medium transition"
          >
            Go to Command Center
          </a>
        </div>
      </div>

      <p className="text-sm text-slate-400 mb-4 print:text-black">
        Hand each region&apos;s login to the team staffing it. Passwords are shown here for as long as the session is
        running — this page can be revisited any time to reprint them.
      </p>

      <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6 print:hidden">
        <QrCode value={typeof window !== "undefined" ? `${window.location.origin}/login` : "/login"} size={112} />
        <div className="text-sm text-slate-300">
          <p className="font-medium text-slate-100 mb-1">On phones, install before logging in</p>
          <p className="text-slate-400">
            Have each team scan this code and add the site to their home screen (Share → Add to Home Screen on
            iPhone) <span className="font-medium text-slate-300">before</span> they log in. On iOS, installing after
            login starts a separate, signed-out session — installing first avoids that.
          </p>
        </div>
      </div>

      <table className="w-full text-sm border-collapse mb-8">
        <thead>
          <tr className="text-left text-slate-400 border-b border-slate-800">
            <th className="py-2 pr-4">Region</th>
            <th className="py-2 pr-4">Username</th>
            <th className="py-2">Password</th>
          </tr>
        </thead>
        <tbody>
          {credentials.map((c) => (
            <tr key={c.regionId} className="border-b border-slate-800 text-slate-200">
              <td className="py-2 pr-4 font-medium">{c.regionId}</td>
              <td className="py-2 pr-4 font-mono">{c.username}</td>
              <td className="py-2 font-mono">{c.password ?? "(cleared after the session completed)"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {displayToken && (
        <p className="text-sm text-slate-400 print:text-black">
          Projector display (no login required): <code>/display/{displayToken}</code>
        </p>
      )}
    </div>
  );
}
