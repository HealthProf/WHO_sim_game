"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PillButton } from "@/components/ui/pill-button";
import { AppFooter } from "@/components/app-footer";
import { REGIONS } from "@/lib/regions";

const DURATIONS = [30, 45, 60, 90];

// Solo play role picker (Release 3), shown right after starting a solo game.
export default function SoloSetupPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { update } = useSession();
  const [region, setRegion] = useState<string>("AMRO");
  const [duration, setDuration] = useState(45);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(body: Record<string, unknown>) {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/sessions/${params.id}/solo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setPending(false);
      setError(json.error ?? "Couldn't start the game.");
      return;
    }
    await update({});
    router.push(json.landing);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-6 sm:p-8">
        <div>
          <h1 className="font-heading text-[32px] leading-tight text-text">How do you want to play?</h1>
          <p className="mt-1 text-[15px] text-neutral-800">The computer plays every seat you don&apos;t.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="flex flex-col gap-3 rounded-lg bg-surface p-5">
            <h2 className="font-heading text-[22px] text-text">Play one region</h2>
            <p className="text-sm text-neutral-800">
              The most realistic way to play alone. You run one regional office; the computer runs the facilitator and the other
              five regions, releasing events, grading your decisions, and answering requests.
            </p>
            <label className="text-sm font-semibold text-text">
              Region
              <select value={region} onChange={(e) => setRegion(e.target.value)} className="mt-1 block w-full rounded-full border-2 border-divider bg-bg px-4 py-2 font-normal">
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <p className="text-sm font-semibold text-text">Game length</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {DURATIONS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={duration === m}
                    onClick={() => setDuration(m)}
                    className={duration === m ? "rounded-full bg-accent-700 px-3.5 py-1.5 text-xs font-bold text-white" : "rounded-full bg-bg px-3.5 py-1.5 text-xs text-neutral-800"}
                  >
                    {m} min
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-neutral-700">Each event gives you 7 to 11 minutes, like a class session. You can pause any time.</p>
            </div>
            <PillButton onClick={() => choose({ role: "region", regionId: region, durationMinutes: duration })} disabled={pending} className="mt-auto">
              Play as {region}
            </PillButton>
          </section>

          <section className="flex flex-col gap-3 rounded-lg bg-surface p-5">
            <h2 className="font-heading text-[22px] text-text">Be the facilitator</h2>
            <p className="text-sm text-neutral-800">
              Run the Command page yourself: release events, grade decisions, and step into any region whenever you like. The
              computer plays all six regions on a fast, roughly 15-minute clock. Good for learning the facilitator&apos;s side.
            </p>
            <PillButton tone="ghost" onClick={() => choose({ role: "facilitator" })} disabled={pending} className="mt-auto">
              Be the facilitator
            </PillButton>
          </section>
        </div>

        {error && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-accent-800">{error}</p>
            {/* A solo game started before roles existed keeps its original
                setup: continue it from the Command page. */}
            {error.includes("already started") && (
              <PillButton tone="ghost" size="sm" onClick={() => router.push("/control")}>
                Continue this game
              </PillButton>
            )}
          </div>
        )}
      </div>
      <AppFooter />
    </div>
  );
}
