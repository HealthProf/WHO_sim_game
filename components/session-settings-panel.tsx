"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import type { FeatureUnlockState, GatedFeature } from "@/lib/feature-unlock";

export interface SessionSettings {
  autoAcceptScores: boolean;
  resultsRevealForced: boolean;
  showExpectedEffects: boolean;
  featuresUnlockedEarly: boolean;
}

// Release 2 facilitator switches, all saved per session via
// PATCH /api/instructor/settings.
export function SessionSettingsPanel({
  settings,
  unlocks,
}: {
  settings: SessionSettings;
  unlocks: Record<GatedFeature, FeatureUnlockState> | undefined;
}) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (patch: Partial<SessionSettings>) => apiFetch("/api/instructor/settings", { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
  });

  const lockLine = (f: GatedFeature, name: string) => {
    const u = unlocks?.[f];
    if (!u) return null;
    return (
      <span>
        {name}: {u.open ? "open" : `opens in ${u.eventsUntilOpen} more event${u.eventsUntilOpen === 1 ? "" : "s"}`}
      </span>
    );
  };

  const rows: { key: keyof SessionSettings; label: string; help: React.ReactNode }[] = [
    {
      key: "showExpectedEffects",
      label: "Show expected effects on event pages",
      help: "Each choice lists its likely effect on the team's region and the world, as a range. Turn off if it's making the right answer too obvious.",
    },
    {
      key: "resultsRevealForced",
      label: "Always show decision results to teams",
      help: "Off: each team chooses whether to look at how a scored decision affected them and the world. On: shown to every team, no choice.",
    },
    {
      key: "autoAcceptScores",
      label: "Auto-accept provisional grades",
      help: "Scores each submission with its rule-based grade about a minute after it arrives, so prerequisite events aren't held up. Items needing review are never auto-accepted.",
    },
    {
      key: "featuresUnlockedEarly",
      label: "Open pledges, funding, and marketplace now",
      help: (
        <span className="flex flex-wrap gap-x-3">
          <span>Otherwise they phase in as events are released.</span>
          {lockLine("pledges", "Pledges & Funding")}
          {lockLine("market", "Marketplace")}
        </span>
      ),
    },
  ];

  return (
    <section className="rounded-lg bg-surface p-5">
      <h2 className="mb-3 text-sm font-bold text-text">Session settings</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {rows.map((r) => (
          <label key={r.key} className="flex cursor-pointer items-start gap-3 rounded-md bg-bg p-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings[r.key]}
              disabled={save.isPending}
              onChange={(e) => save.mutate({ [r.key]: e.target.checked })}
            />
            <span>
              <span className="block text-sm font-semibold text-text">{r.label}</span>
              <span className="block text-xs text-neutral-700">{r.help}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
