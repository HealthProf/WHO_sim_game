"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { QueryError } from "@/components/query-error";

interface InboxItem {
  decision: { id: number; teamId: number; rationaleText: string; structuredChoice: string | null; resourceAllocationJson: Record<string, number> | null; coordinatedWithTeamsJson: string[] | null };
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
  if (!item) return <p className="text-slate-400">Loading submission...</p>;

  const compositePct = ((evidenceScore * 0.4 + politicalScore * 0.3 + equityScore * 0.3) / 4) * 100;
  const tier = compositePct >= 85 ? "OPTIMAL" : compositePct >= 65 ? "ADEQUATE" : compositePct >= 40 ? "INADEQUATE" : "CRITICAL_FAILURE";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{item.event?.title}</h2>
        <p className="text-xs text-slate-500">{item.team?.regionId} - suggested tier from structured choice: {item.suggestedTier ?? "n/a"}</p>
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-sm space-y-2">
        <p><span className="text-slate-500">Choice: </span>{item.decision.structuredChoice ?? "-"}</p>
        {item.decision.resourceAllocationJson && (
          <p><span className="text-slate-500">Allocation: </span>{JSON.stringify(item.decision.resourceAllocationJson)}</p>
        )}
        <p><span className="text-slate-500">Coordinated with: </span>{(item.decision.coordinatedWithTeamsJson ?? []).join(", ") || "none reported"}</p>
        <p className="whitespace-pre-wrap"><span className="text-slate-500">Rationale: </span>{item.decision.rationaleText}</p>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-xs text-slate-400 space-y-1">
        <p><b className="text-emerald-400">Optimal:</b> {item.event?.consequencesJson.optimal}</p>
        <p><b className="text-blue-400">Adequate:</b> {item.event?.consequencesJson.adequate}</p>
        <p><b className="text-amber-400">Inadequate:</b> {item.event?.consequencesJson.inadequate}</p>
        <p><b className="text-red-400">Critical:</b> {item.event?.consequencesJson.critical}</p>
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

        <p className="text-sm">
          Composite: <span className="font-semibold">{compositePct.toFixed(1)}%</span> - Tier:{" "}
          <span className="font-semibold">{tier}</span>
        </p>

        <input
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          placeholder="Override note (optional, required if you disagree with the suggested tier)"
          className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
        />

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button className="rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2">
          Finalize Score
        </button>
      </form>
    </div>
  );
}

function ScoreSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="text-sm font-medium mb-1">{label}: {value}/4</p>
      <input type="range" min={1} max={4} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full" />
    </div>
  );
}
