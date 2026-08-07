"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { QrCode } from "@/components/qr-code";
import { PillButton, PillLink } from "@/components/ui/pill-button";

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

  if (error) return <div className="max-w-2xl mx-auto p-8 text-[15px] text-accent-700">{error}</div>;
  if (!credentials) return <div className="max-w-2xl mx-auto p-8 text-[15px] text-neutral-700">Loading…</div>;

  return (
    <div className="max-w-2xl mx-auto p-8 print:text-black">
      <div className="flex items-start justify-between gap-4 mb-6 print:hidden">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-accent-700 mb-1.5">
            Hand one row to each team
          </p>
          <h1 className="font-heading text-[32px] text-text">Session credentials</h1>
        </div>
        <div className="flex gap-2 shrink-0">
          <PillButton type="button" onClick={() => window.print()} tone="ghost">
            Print
          </PillButton>
          <PillLink href="/control">Command Center</PillLink>
        </div>
      </div>

      <p className="text-[15px] text-neutral-800 mb-4 print:text-black leading-[1.55]">
        Hand each region&apos;s login to the team staffing it. Passwords are shown here for as long as the session is
        running — this page can be revisited any time to reprint them.
      </p>

      <div className="flex items-center gap-[18px] bg-accent-2-100 rounded-lg p-5 mb-6 print:hidden">
        <QrCode value={typeof window !== "undefined" ? `${window.location.origin}/login` : "/login"} size={112} />
        <div className="text-[15px]">
          <p className="font-heading text-[19px] text-accent-2-900 mb-1">On phones, install before logging in</p>
          <p className="text-[13px] text-accent-2-700 leading-[1.5]">
            Have each team scan this code and add the site to their home screen (Share → Add to Home Screen on
            iPhone) <b>before</b> they log in. On iOS, installing after login starts a separate, signed-out session —
            installing first avoids that.
          </p>
        </div>
      </div>

      <table className="w-full text-[15px] border-collapse mb-8">
        <thead>
          <tr className="text-left text-neutral-700 border-b-2 border-divider">
            <th className="py-2 pr-4 text-[12px] font-medium">Region</th>
            <th className="py-2 pr-4 text-[12px] font-medium">Username</th>
            <th className="py-2 text-[12px] font-medium">Password</th>
          </tr>
        </thead>
        <tbody>
          {credentials.map((c) => (
            <tr key={c.regionId} className="border-b border-divider text-text">
              <td className="py-2.5 pr-4 font-bold">{c.regionId}</td>
              <td className="py-2.5 pr-4 font-mono">{c.username}</td>
              <td className="py-2.5 font-mono">{c.password ?? "(cleared after the session completed)"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {displayToken && (
        <p className="text-[13px] text-neutral-700 print:text-black">
          Projector display (no login required):{" "}
          <code className="font-mono bg-surface rounded-md px-2 py-0.5">/display/{displayToken}</code>
        </p>
      )}
    </div>
  );
}
