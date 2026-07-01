"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { realMsToGameDays, formatGameDays } from "@/lib/sim-clock";
import { QueryError } from "@/components/query-error";

interface EventFull {
  id: string;
  title: string;
  narrativeMarkdown: string;
  decisionPromptMarkdown: string;
  minRationaleWords: number;
  structuredOptionsJson: { label: string; text: string }[] | null;
  isAllocationEvent: boolean;
  deadlineType: string;
}

interface EventsData {
  events: EventFull[];
  dispatches: { id: number; eventId: string; status: string; deadlineAt: string | null }[];
}

const REGIONS = ["AFRO", "AMRO", "EMRO", "EURO", "SEARO", "WPRO"];

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dispatchId = Number(params.dispatchId);
  const qc = useQueryClient();

  const { data, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ["events"],
    queryFn: () => apiFetch<EventsData>("/api/events"),
  });
  const { data: dash } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<{ globalState: { gameDaysPerRealMinute: number } }>("/api/dashboard"),
    refetchInterval: 15000,
  });

  const [structuredChoice, setStructuredChoice] = useState("");
  const [rationale, setRationale] = useState("");
  const [coordinatedWith, setCoordinatedWith] = useState<string[]>([]);
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
  if (isLoading || !data) return <p className="text-slate-400">Loading...</p>;

  const dispatch = data.dispatches.find((d) => d.id === dispatchId);
  const event = data.events.find((e) => e.id === dispatch?.eventId);
  if (!dispatch || !event) return <p className="text-slate-400">Event not found.</p>;

  const allocationTotal = Object.values(allocation).reduce((a, b) => a + b, 0);
  const alreadyResolved = dispatch.status === "scored" || dispatch.status === "closed";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold">{event.title}</h2>
        <p className="text-xs text-slate-500 uppercase mt-1">{event.id} - {event.deadlineType} deadline</p>
        {dispatch.deadlineAt && (
          <DeadlineCountdown deadlineAt={dispatch.deadlineAt} gameDaysPerRealMinute={dash?.globalState.gameDaysPerRealMinute ?? 1.5} />
        )}
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-sm text-slate-300">
        <p className="whitespace-pre-wrap">{event.narrativeMarkdown}</p>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-sm text-slate-200">
        <p className="font-medium mb-2">Decision Prompt</p>
        <p className="whitespace-pre-wrap text-slate-300">{event.decisionPromptMarkdown}</p>
      </section>

      {alreadyResolved ? (
        <p className="text-emerald-400 text-sm">This event has been scored and closed.</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
          className="space-y-4"
        >
          {event.structuredOptionsJson && (
            <div>
              <p className="text-sm font-medium mb-2">Structured Choice</p>
              <div className="space-y-2">
                {event.structuredOptionsJson.map((opt) => (
                  <label key={opt.label} className="flex gap-2 items-start bg-slate-900 border border-slate-800 rounded-lg p-3 cursor-pointer">
                    <input
                      type="radio"
                      name="choice"
                      value={opt.label}
                      checked={structuredChoice === opt.label}
                      onChange={() => setStructuredChoice(opt.label)}
                      className="mt-1"
                    />
                    <span className="text-sm">
                      <span className="font-semibold">{opt.label}) </span>
                      {opt.text}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {event.isAllocationEvent && (
            <div>
              <p className="text-sm font-medium mb-2">
                Dose Allocation (must total 180,000) - current total: {allocationTotal.toLocaleString()}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {REGIONS.map((r) => (
                  <label key={r} className="text-sm">
                    {r}
                    <input
                      type="number"
                      min={0}
                      value={allocation[r]}
                      onChange={(e) => setAllocation({ ...allocation, [r]: Number(e.target.value) })}
                      className="mt-1 w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-1"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-medium mb-2">Coordinated with</p>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map((r) => (
                <label key={r} className="flex items-center gap-1 text-sm bg-slate-900 border border-slate-800 rounded-full px-3 py-1">
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
            <p className="text-sm font-medium mb-2">Rationale (optional, but strongly encouraged — this is what the instructor scores)</p>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={8}
              className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submit.isPending}
            className="rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
          >
            {submit.isPending ? "Submitting..." : "Submit Decision"}
          </button>
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
    <p className={`text-sm mt-2 font-medium ${expired ? "text-red-400" : "text-amber-400"}`}>
      {expired ? "Deadline passed" : `Deadline in ${minutes}m ${seconds}s (≈ ${formatGameDays(gameDaysRemaining)})`}
    </p>
  );
}
