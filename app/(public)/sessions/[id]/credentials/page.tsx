"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { QrCode } from "@/components/qr-code";
import { PillButton, PillLink } from "@/components/ui/pill-button";
import { OpenDisplayButton } from "@/components/open-display-button";
import { AppFooter } from "@/components/app-footer";
import { SCENARIO_OVERVIEW_TOTAL_SECONDS } from "@/lib/db/seed-data/scenario-overview-slides";

// Update 4c: the login site's URL, needed on screen *and* on the printed
// sheet — a printed row of usernames/passwords with no URL on it is useless
// to a team that receives it. Verified against lib/auth.ts: region teams
// sign in at this same main-site login, not a per-game URL — the QR below
// encodes the same address.
const APP_ORIGIN = "https://who-sim-game.vercel.app";
const LOGIN_URL = `${APP_ORIGIN}/login`;

interface Credential {
  regionId: string;
  username: string;
  password: string | null;
}

export default function SessionCredentialsPage() {
  const params = useParams<{ id: string }>();
  const [credentials, setCredentials] = useState<Credential[] | null>(null);
  const [displayToken, setDisplayToken] = useState<string | null>(null);
  const [computerRegions, setComputerRegions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [scenarioOverviewState, setScenarioOverviewState] = useState<"idle" | "starting" | "started" | "error">("idle");

  useEffect(() => {
    fetch(`/api/sessions/${params.id}/credentials`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json) => {
        setCredentials(json.credentials);
        setComputerRegions(json.computerRegions ?? []);
        setDisplayToken(json.session.displayToken);
      })
      .catch(() => setError("Couldn't load this session's credentials."));
  }, [params.id]);

  // Update 3, Class Session mode's trigger for the Scenario Overview deck —
  // demo mode starts it automatically at session creation instead (see
  // lib/session-lifecycle.ts createSession), since demo has no login step
  // for an instructor to press this from. Runs on every connected screen
  // (region logins, the instructor console, the projector) simultaneously —
  // see components/scenario-overview-watcher.tsx.
  async function startScenarioOverview() {
    setScenarioOverviewState("starting");
    const res = await fetch("/api/instructor/scenario-overview", { method: "POST" });
    setScenarioOverviewState(res.ok ? "started" : "error");
  }

  if (error) return <div className="max-w-2xl mx-auto p-8 text-[15px] text-accent-700">{error}</div>;
  if (!credentials) return <div className="max-w-2xl mx-auto p-8 text-[15px] text-neutral-700">Loading…</div>;

  return (
    <div className="min-h-screen flex flex-col bg-bg print:block">
    <div className="flex-1 max-w-2xl mx-auto p-8 w-full print:text-black">
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

      <div className="flex items-center gap-3 mb-6 print:hidden">
        <PillButton
          type="button"
          tone="sage"
          onClick={startScenarioOverview}
          disabled={scenarioOverviewState === "starting" || scenarioOverviewState === "started"}
        >
          {scenarioOverviewState === "starting" ? "Starting…" : "Scenario Overview"}
        </PillButton>
        <span className="text-[13px] text-neutral-700">
          {scenarioOverviewState === "started"
            ? `Started — runs on every connected screen and the projector, ~${SCENARIO_OVERVIEW_TOTAL_SECONDS} seconds.`
            : "Plays the opening briefing sequence on every logged-in screen and the projector."}
        </span>
      </div>
      {scenarioOverviewState === "error" && (
        <p className="text-[13px] text-accent-700 mb-6 print:hidden">Couldn&apos;t start the scenario overview. Try again.</p>
      )}

      <div className="flex items-start gap-[18px] bg-accent-2-100 rounded-lg p-5 mb-6 print:hidden">
        <QrCode path="/login" size={112} />
        <div className="text-[15px] space-y-4">
          <div>
            <p className="font-heading text-[19px] text-accent-2-900 mb-1">Sign-in address</p>
            <p className="text-[13px] text-accent-2-700 leading-[1.5]">
              <a href={LOGIN_URL} className="font-mono underline decoration-1 underline-offset-2">
                {LOGIN_URL}
              </a>{" "}
              — scan the code or type this in on any device.
            </p>
          </div>

          <div>
            <p className="font-heading text-[19px] text-accent-2-900 mb-1">On phones, install before logging in</p>
            <p className="text-[13px] text-accent-2-700 leading-[1.5] mb-2">
              Have each team add the site to their home screen <b>before</b> they log in. On iOS, installing after
              login starts a separate, signed-out session — installing first avoids that.
            </p>
            <dl className="text-[13px] text-accent-2-700 leading-[1.5] space-y-1.5">
              <div>
                <dt className="font-semibold text-accent-2-900 inline">iPhone (Safari):</dt>{" "}
                <dd className="inline">Share button → Add to Home Screen → Add.</dd>
              </div>
              <div>
                <dt className="font-semibold text-accent-2-900 inline">Android (Chrome):</dt>{" "}
                <dd className="inline">⋮ menu → Add to Home screen (or Install app) → Install.</dd>
              </div>
              <div>
                <dt className="font-semibold text-accent-2-900 inline">Android (Firefox):</dt>{" "}
                <dd className="inline">⋮ menu → Add to Home screen → Add.</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {/* Print-only: the on-screen QR/install callout above is print:hidden,
          so without this a printed sheet would show usernames and passwords
          with no indication of where to use them (Update 4c). */}
      <p className="hidden print:block text-[13px] text-black mb-4">
        Sign in at: <span className="font-mono">{LOGIN_URL}</span>
      </p>

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
              {computerRegions.includes(c.regionId) ? (
                <td colSpan={2} className="py-2.5 text-neutral-700">
                  Computer-run (no login needed)
                </td>
              ) : (
                <>
                  <td className="py-2.5 pr-4 font-mono">{c.username}</td>
                  <td className="py-2.5 font-mono">{c.password ?? "(cleared after the session completed)"}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {displayToken && (
        <div className="flex items-center gap-3 print:hidden">
          <OpenDisplayButton
            displayToken={displayToken}
            label="Open projector display"
            className="inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-colors duration-150 border-2 border-divider text-text hover:bg-surface active:bg-neutral-200 px-[18px] py-[8px] text-[13px]"
          />
          <span className="text-[12px] text-neutral-700">No login required — safe to open on the room projector.</span>
        </div>
      )}
      {displayToken && (
        <p className="hidden print:block text-[13px] text-black mt-3">
          Projector display (no login required):{" "}
          <span className="font-mono">
            {APP_ORIGIN}/display/{displayToken}
          </span>
        </p>
      )}
    </div>
      <AppFooter />
    </div>
  );
}
