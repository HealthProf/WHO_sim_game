"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PillButton } from "@/components/ui/pill-button";
import { AppFooter } from "@/components/app-footer";
import type { RegionSetup } from "@/lib/region-setup";
import type { CompetenceProfile } from "@/lib/autoplayer";
import { PATHOGENS, PATHOGEN_IDS, type PathogenId } from "@/lib/pathogens";
import { PathogenCard } from "@/components/pathogen-card";

const PROFILE_HELP: Record<CompetenceProfile, string> = {
  strong: "Usually makes evidence-based, equitable calls.",
  mixed: "A realistic mix of good and weaker calls.",
  struggling: "Often picks weaker options and sometimes misses deadlines.",
};
const DURATIONS = [45, 60, 75, 90];

// Class-session setup (Release 3): choose which regions students play and
// which the computer plays, and the game length. Shown right after creating
// a class session, and reachable from the Command Center later (e.g. to hand
// an absent team's region to the computer mid-game).
export default function ClassSetupPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [regions, setRegions] = useState<RegionSetup[] | null>(null);
  const [duration, setDuration] = useState(75);
  const [started, setStarted] = useState(false);
  const [pathogenId, setPathogenId] = useState<PathogenId>("ncov");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/sessions/${params.id}/setup`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => {
        setRegions(j.regions);
        setDuration(j.targetDurationMinutes);
        setStarted(j.started);
        setPathogenId(j.pathogenId);
      })
      .catch(() => setError("Couldn't load this session's setup."));
  }, [params.id]);

  function update(regionId: string, patch: Partial<RegionSetup>) {
    setRegions((rs) => rs!.map((r) => (r.regionId === regionId ? { ...r, ...patch } : r)));
  }

  async function save(next: string) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/sessions/${params.id}/setup`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regions, durationMinutes: started ? undefined : duration, pathogenId: started ? undefined : pathogenId }),
    });
    setSaving(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't save the setup.");
      return;
    }
    router.push(next);
  }

  if (error && !regions) return <div className="mx-auto max-w-2xl p-8 text-[15px] text-accent-700">{error}</div>;
  if (!regions) return <div className="mx-auto max-w-2xl p-8 text-[15px] text-neutral-700">Loading…</div>;

  const players = regions.filter((r) => !r.computer).length;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-6 sm:p-8">
        <div>
          <h1 className="font-heading text-[32px] leading-tight text-text">Set up your class session</h1>
          <p className="mt-1 text-[15px] text-neutral-800">
            Choose who plays each region. Computer-run regions answer their own events and take part in pledges and the
            marketplace; they don&apos;t need a login.
          </p>
        </div>

        <section className="space-y-2" aria-label="Regions">
          {regions.map((r) => (
            <div key={r.regionId} className="flex flex-wrap items-center gap-3 rounded-lg bg-surface px-4 py-3">
              <span className="w-16 font-heading text-[19px] text-text">{r.regionId}</span>
              <div role="radiogroup" aria-label={`${r.regionId} player`} className="inline-flex rounded-full bg-neutral-200 p-[4px] text-sm">
                {[
                  { v: false, label: "Students" },
                  { v: true, label: "Computer" },
                ].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    role="radio"
                    aria-checked={r.computer === o.v}
                    onClick={() => update(r.regionId, { computer: o.v })}
                    className={r.computer === o.v ? "rounded-full bg-bg px-4 py-1.5 font-bold text-text shadow-sm" : "rounded-full px-4 py-1.5 text-neutral-700"}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {r.computer && (
                <label className="flex flex-1 flex-wrap items-center gap-2 text-sm text-neutral-800">
                  Skill
                  <select
                    value={r.profile}
                    onChange={(e) => update(r.regionId, { profile: e.target.value as CompetenceProfile })}
                    className="rounded-full border-2 border-divider bg-bg px-3 py-1"
                  >
                    <option value="strong">Strong</option>
                    <option value="mixed">Mixed</option>
                    <option value="struggling">Struggling</option>
                  </select>
                  <span className="text-xs text-neutral-700">{PROFILE_HELP[r.profile]}</span>
                </label>
              )}
            </div>
          ))}
          <p className="text-xs text-neutral-700">
            {players} region{players === 1 ? "" : "s"} played by students, {6 - players} by the computer. Computer regions also
            react to how their region is doing: low trust or morale makes their calls worse.
          </p>
        </section>

        <section className="space-y-2">
          <label htmlFor="pathogen" className="text-sm font-semibold text-text">
            Pathogen {started ? "(locked once the game starts)" : "(drawn at random; change it if you like)"}
          </label>
          <select
            id="pathogen"
            value={pathogenId}
            disabled={started}
            onChange={(e) => setPathogenId(e.target.value as PathogenId)}
            className="block rounded-full border-2 border-divider bg-bg px-4 py-2 text-sm"
          >
            {PATHOGEN_IDS.map((id) => (
              <option key={id} value={id}>
                {PATHOGENS[id].name} ({PATHOGENS[id].codeName})
              </option>
            ))}
          </select>
          <PathogenCard pathogenId={pathogenId} showSources />
        </section>

        {!started && (
          <section className="space-y-2">
            <p className="text-sm font-semibold text-text">Game length (play time, not counting briefing or debrief)</p>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={duration === m}
                  onClick={() => setDuration(m)}
                  className={duration === m ? "rounded-full bg-accent-700 px-4 py-1.5 text-sm font-bold text-white" : "rounded-full bg-surface px-4 py-1.5 text-sm text-neutral-800"}
                >
                  {m} min
                </button>
              ))}
            </div>
          </section>
        )}

        {error && <p className="text-sm font-medium text-accent-800">{error}</p>}

        <div className="flex flex-wrap gap-3">
          <PillButton onClick={() => save(`/sessions/${params.id}/credentials`)} disabled={saving || players === 0}>
            {saving ? "Saving…" : "Save and show the login sheet"}
          </PillButton>
          <PillButton tone="ghost" onClick={() => save("/control")} disabled={saving || players === 0}>
            Save and go to Command
          </PillButton>
        </div>
        {players === 0 && <p className="text-xs text-accent-800">Keep at least one region for students, or use Solo play instead.</p>}
      </div>
      <AppFooter />
    </div>
  );
}
