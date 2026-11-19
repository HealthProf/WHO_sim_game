"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { QueryError } from "@/components/query-error";
import { PillButton } from "@/components/ui/pill-button";
import { TierChip } from "@/components/ui/chip";
import { DIMENSIONS, TIER_SCALE, rubricsForCategory } from "@/lib/rubric";
import { wordCount } from "@/lib/auto-grade";
import type { Tier } from "@/lib/scoring";

interface Provisional {
  scores: { evidenceScore: number; politicalScore: number; equityScore: number };
  tier: Tier;
  reasons: string[];
  needsReview: boolean;
  reviewReason: string | null;
}

interface InboxItem {
  decision: {
    id: number;
    teamId: number;
    rationaleText: string;
    structuredChoice: string | null;
    resourceAllocationJson: Record<string, number> | null;
    coordinatedWithTeamsJson: string[] | null;
    confidenceLevel: string | null;
  };
  event: {
    id: string;
    title: string;
    category: string;
    narrativeMarkdown: string;
    consequencesJson: { optimal: string; adequate: string; inadequate: string; critical: string };
    structuredOptionsJson: { label: string; text: string; suggestedTier: Tier }[] | null;
  } | null;
  team: { regionId: string } | null;
  provisional: Provisional | null;
}

// What each 1-4 step means, from the tier scale in
// simulation-docs/02-decision-matrix.md (4 = Optimal ... 1 = Critical).
const STEP_LABEL: Record<number, string> = { 4: "Optimal", 3: "Adequate", 2: "Inadequate", 1: "Critical" };

export default function ScoreDecisionPage() {
  const params = useParams();
  const router = useRouter();
  const decisionId = Number(params.decisionId);

  const { data, error: queryError, refetch } = useQuery({
    queryKey: ["scoring-inbox"],
    queryFn: () => apiFetch<{ inbox: InboxItem[] }>("/api/scores"),
  });
  const item = data?.inbox.find((i) => i.decision.id === decisionId);

  // null = "not touched yet, show the provisional grade".
  const [touched, setTouched] = useState<{ evidenceScore?: number; politicalScore?: number; equityScore?: number }>({});
  const [overrideReason, setOverrideReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const p = item?.provisional;
  const evidenceScore = touched.evidenceScore ?? p?.scores.evidenceScore ?? 3;
  const politicalScore = touched.politicalScore ?? p?.scores.politicalScore ?? 3;
  const equityScore = touched.equityScore ?? p?.scores.equityScore ?? 3;

  const submit = useMutation({
    mutationFn: () =>
      apiFetch("/api/scores", {
        method: "POST",
        body: JSON.stringify({ decisionId, evidenceScore, politicalScore, equityScore, overrideReason: overrideReason || undefined }),
      }),
    onSuccess: () => router.push("/scoring"),
    onError: (e: Error) => setError(e.message),
  });
  const accept = useMutation({
    mutationFn: () =>
      apiFetch("/api/scores", { method: "POST", body: JSON.stringify({ decisionId, acceptProvisional: true, confirmReview: true }) }),
    onSuccess: () => router.push("/scoring"),
    onError: (e: Error) => setError(e.message),
  });

  if (queryError) return <QueryError error={queryError} onRetry={() => refetch()} label="submission" />;
  if (!data) return <p className="text-neutral-700">Loading submission...</p>;
  if (!item) return <p className="text-neutral-700">This submission has already been scored.</p>;

  const rawCompositePct = ((evidenceScore * 0.4 + politicalScore * 0.3 + equityScore * 0.3) / 4) * 100;
  const rawTier = rawCompositePct >= 85 ? "OPTIMAL" : rawCompositePct >= 65 ? "ADEQUATE" : rawCompositePct >= 40 ? "INADEQUATE" : "CRITICAL_FAILURE";
  const confidence = item.decision.confidenceLevel;
  const goodRawTier = rawTier === "OPTIMAL" || rawTier === "ADEQUATE";
  const calibrationAdjustment = confidence === "HIGH" ? (goodRawTier ? 3 : -5) : 0;
  const compositePct = Math.max(0, Math.min(100, rawCompositePct + calibrationAdjustment));
  const tier = compositePct >= 85 ? "OPTIMAL" : compositePct >= 65 ? "ADEQUATE" : compositePct >= 40 ? "INADEQUATE" : "CRITICAL_FAILURE";
  const changed = Object.keys(touched).length > 0;
  const option = item.event?.structuredOptionsJson?.find((o) => o.label === item.decision.structuredChoice);
  const rubrics = item.event ? rubricsForCategory(item.event.category) : { matched: [], unmatched: [] };
  const consequences = item.event?.consequencesJson;
  const consequenceByTier: Record<Tier, string | undefined> = {
    OPTIMAL: consequences?.optimal,
    ADEQUATE: consequences?.adequate,
    INADEQUATE: consequences?.inadequate,
    CRITICAL_FAILURE: consequences?.critical,
  };

  return (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      <div className="flex min-w-0 max-w-2xl flex-1 flex-col gap-6">
        <div>
          <h1 className="font-heading text-[30px] text-text">{item.event?.title}</h1>
          <p className="text-xs text-neutral-700">
            {item.team?.regionId} · {item.event?.category}
          </p>
        </div>

        {/* Provisional grade */}
        {p && (
          <section className={`space-y-2 rounded-lg p-4 text-sm ${p.needsReview ? "bg-accent-100" : "bg-accent-2-100"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-text">Provisional grade</span>
              <TierChip tier={p.tier} />
              <span className="text-xs text-neutral-800">
                Evidence {p.scores.evidenceScore} · Political {p.scores.politicalScore} · Equity {p.scores.equityScore}
              </span>
            </div>
            <ul className="space-y-0.5 text-xs text-neutral-800">
              {p.reasons.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
            {p.needsReview && <p className="text-xs font-semibold text-accent-800">Needs review: {p.reviewReason}</p>}
            <PillButton size="sm" tone="sage" onClick={() => accept.mutate()} disabled={accept.isPending || changed}>
              {p.needsReview ? "I've reviewed it: accept provisional grade" : "Accept provisional grade"}
            </PillButton>
            {changed && <p className="text-xs text-neutral-700">You&apos;ve adjusted the sliders; use Finalize below.</p>}
          </section>
        )}

        <section className="space-y-2 rounded-lg bg-surface p-4 text-sm text-text">
          <p>
            <span className="text-neutral-700">Choice: </span>
            {option ? `${option.label}. ${option.text}` : item.decision.structuredChoice ?? "none"}
          </p>
          {item.decision.resourceAllocationJson && (
            <div>
              <span className="text-neutral-700">Allocation: </span>
              <span className="inline-flex flex-wrap gap-x-3">
                {Object.entries(item.decision.resourceAllocationJson).map(([r, n]) => (
                  <span key={r}>
                    {r} {Number(n).toLocaleString()}
                  </span>
                ))}
              </span>
            </div>
          )}
          <p>
            <span className="text-neutral-700">Coordinated with: </span>
            {(item.decision.coordinatedWithTeamsJson ?? []).join(", ") || "none reported"}
          </p>
          <p>
            <span className="text-neutral-700">Confidence wager: </span>
            {confidence ?? "not provided"}
          </p>
          <p className="whitespace-pre-wrap">
            <span className="text-neutral-700">Rationale ({wordCount(item.decision.rationaleText)} words): </span>
            {item.decision.rationaleText || "none"}
          </p>
        </section>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
          className="space-y-4"
        >
          {DIMENSIONS.map((d) => (
            <ScoreSlider
              key={d.key}
              label={`${d.label} (${d.weight})`}
              help={d.measures}
              value={{ evidenceScore, politicalScore, equityScore }[d.key]}
              onChange={(v) => setTouched((t) => ({ ...t, [d.key]: v }))}
            />
          ))}

          <p className="text-sm text-text">
            Raw composite: <span className="font-semibold">{rawCompositePct.toFixed(1)}%</span>
            {calibrationAdjustment !== 0 && (
              <span className="text-neutral-700">
                {" "}
                {calibrationAdjustment > 0 ? "+" : ""}
                {calibrationAdjustment} calibration ({confidence} confidence, {rawTier.toLowerCase()} call)
              </span>
            )}{" "}
            → Final: <span className="font-semibold">{compositePct.toFixed(1)}%</span> · Tier: <TierChip tier={tier} />
          </p>

          <input
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="Note (optional; useful in the debrief when you differ from the provisional grade)"
            className="w-full rounded-full border-2 border-divider bg-bg px-4 py-2 text-sm"
          />

          {error && <p className="text-sm font-medium text-accent-800">{error}</p>}

          <PillButton type="submit" tone="accent" disabled={submit.isPending}>
            Finalize score
          </PillButton>
        </form>
      </div>

      {/* Rubric anchors, from simulation-docs/02-decision-matrix.md */}
      <aside className="w-full space-y-4 rounded-lg bg-surface p-4 text-xs text-neutral-800 xl:sticky xl:top-6 xl:max-w-md" aria-label="Scoring rubric">
        <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-700">How to grade this</p>
        <div className="space-y-1">
          {TIER_SCALE.map((t) => (
            <p key={t.tier} className="flex items-center gap-2">
              <TierChip tier={t.tier} /> {t.score} per dimension · composite {t.range}
            </p>
          ))}
        </div>
        {rubrics.matched.map((r) => (
          <div key={r.name}>
            <p className="mb-1 font-semibold text-text">{r.name}</p>
            <dl className="space-y-1.5">
              {TIER_SCALE.map((t) => (
                <div key={t.tier}>
                  <dt className="font-semibold">{STEP_LABEL[Number(t.score[0])]}</dt>
                  <dd>{r.tiers[t.tier]}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        {rubrics.unmatched.length > 0 && (
          <p className="text-neutral-700">
            The decision matrix has no dedicated table for {rubrics.unmatched.join(", ")}; grade it with the three dimension
            definitions.
          </p>
        )}
        {consequences && (
          <div>
            <p className="mb-1 font-semibold text-text">This event&apos;s designed outcomes</p>
            <dl className="space-y-1.5">
              {TIER_SCALE.map((t) => (
                <div key={t.tier}>
                  <dt className="font-semibold">{STEP_LABEL[Number(t.score[0])]}</dt>
                  <dd>{consequenceByTier[t.tier]}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </aside>
    </div>
  );
}

function ScoreSlider({ label, help, value, onChange }: { label: string; help: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="text-sm font-medium text-text">
        {label}: {value}/4 <span className="font-normal text-neutral-700">({STEP_LABEL[value]})</span>
      </p>
      <p className="mb-1 text-xs text-neutral-700">{help}</p>
      <input
        type="range"
        min={1}
        max={4}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-accent-700)]"
        aria-valuetext={`${value} of 4, ${STEP_LABEL[value]}`}
      />
    </div>
  );
}
