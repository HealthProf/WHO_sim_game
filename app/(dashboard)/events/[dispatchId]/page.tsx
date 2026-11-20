"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { realMsToGameDays, formatGameDays } from "@/lib/sim-clock";
import { QueryError } from "@/components/query-error";
import { KeyTerms } from "@/components/key-terms";
import { AdvisoryBoard } from "@/components/advisory-board";
import { EventStatusBadge } from "@/components/event-status-badge";
import { GlossaryText } from "@/components/glossary-text";
import { EventSummary } from "@/components/event-summary";
import { EventResult } from "@/components/event-result";
import { disruptorById } from "@/lib/disruptor-content";
import type { ModelDelta } from "@/lib/db/seed-data/events";
import { effectiveMinWords, wordCount } from "@/lib/auto-grade";
import { affordabilityIssue, formatCost, type OwnRegionResources } from "@/lib/affordability";
import type { StructuredOption as FullStructuredOption } from "@/lib/db/seed-data/events";
import { REGIONS } from "@/lib/regions";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PillButton } from "@/components/ui/pill-button";

type StructuredOption = Pick<FullStructuredOption, "label" | "text" | "cost" | "impactDesc" | "suggestedTier">;

interface EventFull {
  id: string;
  title: string;
  narrativeMarkdown: string;
  decisionPromptMarkdown: string;
  minRationaleWords: number;
  structuredOptionsJson: StructuredOption[] | null;
  modelDeltaJson: Record<string, ModelDelta[]> | null;
  isAllocationEvent: boolean;
  deadlineType: string;
}

interface EventsData {
  events: EventFull[];
  dispatches: { id: number; eventId: string; status: string; deadlineAt: string | null; disruptionsJson?: { id: string; at: string }[] | null }[];
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dispatchId = Number(params.dispatchId);
  const qc = useQueryClient();

  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ["events"],
    queryFn: () => apiFetch<EventsData>("/api/events"),
    // Release 5: poll so a mid-event development shows up while the team is
    // on this page.
    refetchInterval: 10000,
  });
  const { data: dash } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () =>
      apiFetch<{
        globalState: { gameDaysPerRealMinute: number; showExpectedEffects?: boolean; resultsRevealForced?: boolean; pathogenId?: string };
        ownRegion: (OwnRegionResources & { regionId: string }) | null;
      }>("/api/dashboard"),
    refetchInterval: 15000,
  });

  const [structuredChoice, setStructuredChoice] = useState("");
  const [rationale, setRationale] = useState("");
  const [coordinatedWith, setCoordinatedWith] = useState<string[]>([]);
  const [confidenceLevel, setConfidenceLevel] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [allocation, setAllocation] = useState<Record<string, number>>(
    Object.fromEntries(REGIONS.map((r) => [r, 0]))
  );
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      apiFetch("/api/decisions", {
        method: "POST",
        body: JSON.stringify({
          eventDispatchId: dispatchId,
          structuredChoice: structuredChoice || null,
          rationaleText: rationale,
          coordinatedWithTeamsJson: coordinatedWith,
          confidenceLevel,
          resourceAllocationJson: event?.isAllocationEvent ? allocation : null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      router.push("/events");
    },
    onError: (e: Error) => setError(e.message),
  });

  if (queryError) return <QueryError error={queryError} onRetry={() => refetch()} label="event" />;
  if (isLoading || !data) return <p className="text-neutral-700">Loading...</p>;

  const dispatch = data.dispatches.find((d) => d.id === dispatchId);
  const event = data.events.find((e) => e.id === dispatch?.eventId);
  if (!dispatch || !event) return <p className="text-neutral-700">Event not found.</p>;

  const allocationTotal = Object.values(allocation).reduce((a, b) => a + b, 0);
  // Mid-event developments that have happened for this team (the API only
  // sends ones whose time has come).
  const disruptions = (dispatch.disruptionsJson ?? []).map((p) => disruptorById(p.id)).filter((d): d is NonNullable<typeof d> => !!d);
  const minWords = effectiveMinWords(event.minRationaleWords);
  const rationaleWords = wordCount(rationale);
  const rationaleShort = minWords > 0 && rationaleWords < minWords;
  // A choice is required; the rationale is recommended but optional.
  const needsChoice = !!event.structuredOptionsJson?.length && !structuredChoice;
  const alreadyResolved = dispatch.status === "scored" || dispatch.status === "closed";

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-accent-700">Event · {event.deadlineType.toLowerCase()} deadline</p>
        <h1 className="font-heading text-[30px] text-text">{event.title}</h1>
        <div className="mt-1.5">
          <EventStatusBadge status={dispatch.status} />
        </div>
        {dispatch.deadlineAt && dispatch.status === "dispatched" && (
          <DeadlineCountdown deadlineAt={dispatch.deadlineAt} gameDaysPerRealMinute={dash?.globalState.gameDaysPerRealMinute ?? 1.5} />
        )}
      </div>

      {disruptions.length > 0 && (
        <section className="space-y-2" aria-live="polite">
          {disruptions.map((d) => (
            <div key={d.id} role="status" className="rounded-lg border-l-[6px] border-accent-600 bg-accent-100 p-4 text-sm text-accent-900">
              <p className="text-[11px] font-bold uppercase tracking-wide text-accent-700">Breaking development</p>
              <p className="font-semibold">{d.headline}</p>
              <p className="mt-0.5">{d.text}</p>
              <p className="mt-1 text-xs font-semibold">
                {d.kind === "remove" ? `Option ${d.options.join(", ")} is no longer available.` : d.warning}
              </p>
            </div>
          ))}
        </section>
      )}

      <EventSummary
        eventId={event.id}
        options={event.structuredOptionsJson}
        modelDeltaJson={event.modelDeltaJson}
        ownRegionId={dash?.ownRegion?.regionId}
        showExpectedEffects={dash?.globalState.showExpectedEffects ?? true}
        pathogenId={dash?.globalState.pathogenId}
      />

      <section className="rounded-lg bg-surface p-4 text-[16px] leading-[1.6] text-neutral-800">
        <GlossaryText className="whitespace-pre-wrap" text={event.narrativeMarkdown} />
      </section>

      <section className="rounded-lg bg-surface p-4 text-sm text-neutral-800">
        <p className="mb-2 font-semibold text-text">Decision Prompt</p>
        <GlossaryText className="whitespace-pre-wrap" text={event.decisionPromptMarkdown} />
      </section>

      <KeyTerms texts={[event.narrativeMarkdown, event.decisionPromptMarkdown]} />
      <AdvisoryBoard eventId={event.id} pathogenId={dash?.globalState.pathogenId} />

      {alreadyResolved ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-accent-2-700">This event has been scored and closed.</p>
          <EventResult dispatchId={dispatchId} ownRegionId={dash?.ownRegion?.regionId} forced={!!dash?.globalState.resultsRevealForced} />
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
          className="space-y-5"
        >
          {event.structuredOptionsJson && (
            <div>
              <p className="mb-2 text-sm font-semibold text-text">Structured Choice</p>
              <div className="space-y-2">
                {event.structuredOptionsJson.map((opt) => {
                  const removedBy = disruptions.find((d) => d.kind === "remove" && d.options.includes(opt.label));
                  const warnedBy = disruptions.find((d) => d.kind === "warn" && d.options.includes(opt.label));
                  const blockedReason = removedBy ? `no longer available: ${removedBy.headline}` : affordabilityIssue(opt.cost, dash?.ownRegion ?? undefined);
                  const selected = structuredChoice === opt.label;
                  return (
                    <label
                      key={opt.label}
                      className={`flex items-start gap-3 rounded-lg border-2 p-[15px_18px] ${
                        blockedReason
                          ? "cursor-not-allowed border-divider opacity-45"
                          : selected
                            ? "cursor-pointer border-accent bg-accent-100"
                            : "cursor-pointer border-divider"
                      }`}
                    >
                      <span className={`font-heading text-lg ${selected ? "text-accent-700" : "text-neutral-700"}`}>{opt.label}</span>
                      <span className="flex-1 text-sm">
                        <input
                          type="radio"
                          name="choice"
                          value={opt.label}
                          checked={selected}
                          disabled={!!blockedReason}
                          onChange={() => setStructuredChoice(opt.label)}
                          className="sr-only"
                        />
                        <span className={selected ? "font-semibold text-accent-900" : "text-text"}>{opt.text}</span>
                        <span className="mt-1 block text-xs text-neutral-700">{formatCost(opt.cost)}</span>
                        <span className="mt-1 block text-xs text-neutral-700">{opt.impactDesc}</span>
                        {blockedReason && (
                          <span className="mt-1 block text-xs font-medium text-accent-700">
                            {removedBy ? `Option ${blockedReason}` : `Can't afford this option — ${blockedReason}`}
                          </span>
                        )}
                        {warnedBy && !blockedReason && <span className="mt-1 block text-xs font-semibold text-accent-800">⚠ {warnedBy.warning}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {event.isAllocationEvent && (
            <div>
              <p className="mb-2 text-sm font-semibold text-text">
                Dose Allocation (must total 180,000) — current total: {allocationTotal.toLocaleString()}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {REGIONS.map((r) => (
                  <div key={r} className="rounded-lg bg-surface p-3">
                    {r}
                    <input
                      type="number"
                      min={0}
                      value={allocation[r]}
                      onChange={(e) => setAllocation({ ...allocation, [r]: Number(e.target.value) })}
                      className="mt-1 w-full rounded-full border-2 border-divider bg-bg px-3 py-1.5 text-sm"
                    />
                  </div>
                ))}
                <div className={`rounded-lg p-3 ${allocationTotal === 180000 ? "bg-accent-2-100" : "bg-accent-100"}`}>
                  Unallocated
                  <p className={`text-base font-bold ${allocationTotal === 180000 ? "text-accent-2-800" : "text-accent-800"}`}>
                    {(180000 - allocationTotal).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-semibold text-text">Coordinated with</p>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <label key={r} className="flex items-center gap-1.5 rounded-full border-2 border-divider px-3 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={coordinatedWith.includes(r)}
                    onChange={(e) =>
                      setCoordinatedWith(
                        e.target.checked ? [...coordinatedWith, r] : coordinatedWith.filter((x) => x !== r)
                      )
                    }
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-text">How confident is your team in this decision?</p>
            <p className="mb-2 text-xs text-neutral-700">
              This isn&apos;t scored on whether you were confident — it&apos;s scored on whether your confidence matched the
              outcome. Flagging real uncertainty is never penalized.
            </p>
            <SegmentedControl
              options={[
                { value: "LOW", label: "Low" },
                { value: "MEDIUM", label: "Medium" },
                { value: "HIGH", label: "High" },
              ]}
              value={confidenceLevel}
              onChange={setConfidenceLevel}
            />
          </div>

          <div>
            <label htmlFor="rationale" className="mb-1 block text-sm font-semibold text-text">
              Rationale{minWords > 0 ? ` (optional, about ${minWords} words recommended)` : " (optional)"}
            </label>
            <p className="mb-2 text-xs text-neutral-700">
              Say why, covering the evidence, what&apos;s politically and economically realistic, and who is most affected. Your
              grade is built from these three. Short on time? Submit your choice anyway; a short or missing rationale only
              lowers your provisional grade.
            </p>
            <textarea
              id="rationale"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={5}
              aria-describedby="rationale-count"
              className="w-full rounded-lg border-2 border-divider bg-bg px-[18px] py-[14px] text-[15px]"
            />
            <p id="rationale-count" className={`mt-1 text-xs ${rationaleShort ? "text-accent-800" : "text-accent-2-700"}`} aria-live="polite">
              {rationaleWords} word{rationaleWords === 1 ? "" : "s"}
              {minWords > 0 && (rationaleShort ? ` · ${minWords - rationaleWords} more for full credit` : " · enough")}
            </p>
          </div>

          {error && <p className="text-sm font-medium text-accent-800">{error}</p>}

          {needsChoice && <p className="text-sm text-neutral-700">Pick an option to submit.</p>}
          <PillButton type="submit" disabled={submit.isPending || needsChoice} tone="accent" className="px-[30px] py-3">
            {submit.isPending ? "Submitting..." : "Submit Decision"}
          </PillButton>
        </form>
      )}
    </div>
  );
}

function DeadlineCountdown({ deadlineAt, gameDaysPerRealMinute }: { deadlineAt: string; gameDaysPerRealMinute: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remaining = new Date(deadlineAt).getTime() - now;
  const expired = remaining <= 0;
  const minutes = Math.max(0, Math.floor(remaining / 60000));
  const seconds = Math.max(0, Math.floor((remaining % 60000) / 1000));
  const gameDaysRemaining = realMsToGameDays(Math.max(0, remaining), gameDaysPerRealMinute);

  return (
    <p className={`mt-2 text-sm font-medium ${expired ? "text-accent-800" : "text-accent-700"}`}>
      {expired ? "Deadline passed" : `Deadline in ${minutes}m ${seconds}s (≈ ${formatGameDays(gameDaysRemaining)})`}
    </p>
  );
}
