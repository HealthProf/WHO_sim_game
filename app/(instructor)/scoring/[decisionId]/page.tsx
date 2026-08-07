"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { QueryError } from "@/components/query-error";
import { PillButton } from "@/components/ui/pill-button";
import { TierChip } from "@/components/ui/chip";

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
  event: { id: string; title: string; narrativeMarkdown: string; consequencesJson: { optimal: string; adequate: string; inadequate: string; critical: string } } | null;
  team: { regionId: string } | null;
  suggestedTier: string | null;
}

export default function ScoreDecisionPage() {
  const params = useParams();
  const router = useRouter();
  const decisionId = Number(params.decisionId);

  const { data, error: queryError, refetch } = useQuery({
    queryKey: ["scoring-inbox"],
    queryFn: () => apiFetch<{ inbox: InboxItem[] }>("/api/scores"),
  });

  const [evidenceScore, setEvidenceScore] = useState(3);
  const [politicalScore, setPoliticalScore] = useState(3);
  const [equityScore, setEquityScore] = useState(3);
  const [overrideReason, setOverrideReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      apiFetch("/api/scores", {
        method: "POST",
        body: JSON.stringify({ decisionId, evidenceScore, politicalScore, equityScore, overrideReason: overrideReason || undefined }),
      }),
    onSuccess: () => router.push("/scoring"),
    onError: (e: Error) => setError(e.message),
  });

  const item = data?.inbox.find((i) => i.decision.id === decisionId);
  if (queryError) return <QueryError error={queryError} onRetry={() => refetch()} label="submission" />;
  if (!item) return <p className="text-neutral-700">Loading submission...</p>;

  const rawCompositePct = ((evidenceScore * 0.4 + politicalScore * 0.3 + equityScore * 0.3) / 4) * 100;
  const rawTier = rawCompositePct >= 85 ? "OPTIMAL" : rawCompositePct >= 65 ? "ADEQUATE" : rawCompositePct >= 40 ? "INADEQUATE" : "CRITICAL_FAILURE";
  const confidence = item.decision.confidenceLevel;
  const goodRawTier = rawTier === "OPTIMAL" || rawTier === "ADEQUATE";
  const calibrationAdjustment = confidence === "HIGH" ? (goodRawTier ? 3 : -5) : 0;
  const compositePct = Math.max(0, Math.min(100, rawCompositePct + calibrationAdjustment));
  const tier = compositePct >= 85 ? "OPTIMAL" : compositePct >= 65 ? "ADEQUATE" : compositePct >= 40 ? "INADEQUATE" : "CRITICAL_FAILURE";

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-[30px] text-text">{item.event?.title}</h1>
        <p className="text-xs text-neutral-700">{item.team?.regionId} - suggested tier from structured choice: {item.suggestedTier ?? "n/a"}</p>
      </div>

      <section className="space-y-2 rounded-lg bg-surface p-4 text-sm text-text">
        <p><span className="text-neutral-700">Choice: </span>{item.decision.structuredChoice ?? "-"}</p>
        {item.decision.resourceAllocationJson && (
          <p><span className="text-neutral-700">Allocation: </span>{JSON.stringify(item.decision.resourceAllocationJson)}</p>
        )}
        <p><span className="text-neutral-700">Coordinated with: </span>{(item.decision.coordinatedWithTeamsJson ?? []).join(", ") || "none reported"}</p>
        <p><span className="text-neutral-700">Confidence wager: </span>{confidence ?? "not provided"}</p>
        <p className="whitespace-pre-wrap"><span className="text-neutral-700">Rationale: </span>{item.decision.rationaleText}</p>
      </section>

      <section className="space-y-2 rounded-lg bg-surface p-4 text-xs text-neutral-700">
        <p className="flex items-start gap-2"><TierChip tier="OPTIMAL" /> {item.event?.consequencesJson.optimal}</p>
        <p className="flex items-start gap-2"><TierChip tier="ADEQUATE" /> {item.event?.consequencesJson.adequate}</p>
        <p className="flex items-start gap-2"><TierChip tier="INADEQUATE" /> {item.event?.consequencesJson.inadequate}</p>
        <p className="flex items-start gap-2"><TierChip tier="CRITICAL_FAILURE" /> {item.event?.consequencesJson.critical}</p>
      </section>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate();
        }}
        className="space-y-4"
      >
        <ScoreSlider label="Evidence-Based Practice (40%)" value={evidenceScore} onChange={setEvidenceScore} />
        <ScoreSlider label="Political & Economic Realism (30%)" value={politicalScore} onChange={setPoliticalScore} />
        <ScoreSlider label="Health Equity (30%)" value={equityScore} onChange={setEquityScore} />

        <p className="text-sm text-text">
          Raw composite: <span className="font-semibold">{rawCompositePct.toFixed(1)}%</span>
          {calibrationAdjustment !== 0 && (
            <span className="text-neutral-700"> {calibrationAdjustment > 0 ? "+" : ""}{calibrationAdjustment} calibration ({confidence} confidence, {rawTier.toLowerCase()} call)</span>
          )}
          {" "}→ Final: <span className="font-semibold">{compositePct.toFixed(1)}%</span> - Tier: <TierChip tier={tier} />
        </p>

        <input
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          placeholder="Override note (optional, required if you disagree with the suggested tier)"
          className="w-full rounded-full border-2 border-divider bg-bg px-4 py-2 text-sm"
        />

        {error && <p className="text-sm font-medium text-accent-800">{error}</p>}

        <PillButton type="submit" tone="accent">
          Finalize Score
        </PillButton>
      </form>
    </div>
  );
}

function ScoreSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-text">{label}: {value}/4</p>
      <input type="range" min={1} max={4} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--color-accent-700)]" />
    </div>
  );
}
