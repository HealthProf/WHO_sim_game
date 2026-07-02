"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

interface BudgetCycleData {
  cycle: { id: number; cycleNumber: number; status: string; mode: string | null; closesAt: string | null } | null;
  myDefaultAmount: number | null;
  myResponse: { choice: string; requestedAmount: number | null } | null;
  myDonation: number | null;
  respondedCount: number;
  totalTeams: number;
  requesters: { regionId: string; requestedAmount: number | null }[];
}

// Item 2's periodic budget cycle, team-facing side. Only renders anything
// once the instructor has opened the snap-vote mode (pending_instructor and
// closed cycles are silent — see the Control page for the instructor's own
// panel). Two phases: accept-or-request-more, then (only if someone
// requested more) a donation round for everyone else.
export function BudgetCycleBanner() {
  const qc = useQueryClient();
  const [requestedAmount, setRequestedAmount] = useState("");
  const [donationAmount, setDonationAmount] = useState("");

  const { data } = useQuery({
    queryKey: ["budget-cycle"],
    queryFn: () => apiFetch<BudgetCycleData>("/api/budget-cycle"),
    refetchInterval: 5000,
  });

  const respond = useMutation({
    mutationFn: (opts: { choice: "accept" | "request_more"; requestedAmount?: number }) =>
      apiFetch("/api/budget-cycle", { method: "POST", body: JSON.stringify({ action: "respond", cycleId: data?.cycle?.id, ...opts }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget-cycle"] }),
  });

  const donate = useMutation({
    mutationFn: (amount: number) => apiFetch("/api/budget-cycle", { method: "POST", body: JSON.stringify({ action: "donate", cycleId: data?.cycle?.id, amount }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget-cycle"] }),
  });

  if (!data?.cycle || data.cycle.status === "pending_instructor") return null;
  const { cycle } = data;

  if (cycle.status === "collecting_responses") {
    if (data.myResponse) {
      return (
        <section className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-4 text-sm text-emerald-300">
          Budget cycle #{cycle.cycleNumber}: you {data.myResponse.choice === "accept" ? "accepted the standard disbursement" : `requested $${(data.myResponse.requestedAmount ?? 0).toLocaleString()}`}. Waiting on other regions ({data.respondedCount}/{data.totalTeams} responded).
        </section>
      );
    }
    return (
      <section className="bg-amber-950/40 border-2 border-amber-700 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-amber-300">
          Budget Cycle #{cycle.cycleNumber} — standard disbursement is ${data.myDefaultAmount?.toLocaleString()}. Accept it, or request more.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => respond.mutate({ choice: "accept" })} disabled={respond.isPending} className="rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2">
            Accept ${data.myDefaultAmount?.toLocaleString()}
          </button>
          <input
            type="number"
            min={1}
            value={requestedAmount}
            onChange={(e) => setRequestedAmount(e.target.value)}
            placeholder="Amount to request"
            className="rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm w-40"
          />
          <button
            onClick={() => Number(requestedAmount) > 0 && respond.mutate({ choice: "request_more", requestedAmount: Number(requestedAmount) })}
            disabled={respond.isPending || !(Number(requestedAmount) > 0)}
            className="rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2"
          >
            Request More
          </button>
        </div>
      </section>
    );
  }

  if (cycle.status === "collecting_donations") {
    const amIRequester = data.myResponse?.choice === "request_more";
    if (amIRequester) {
      return (
        <section className="bg-purple-950/40 border border-purple-800 rounded-xl p-4 text-sm text-purple-300">
          Budget cycle #{cycle.cycleNumber}: your request for ${(data.myResponse?.requestedAmount ?? 0).toLocaleString()} is out to the other regions — they have a short window to donate part of their own disbursement to you.
        </section>
      );
    }
    if (data.myDonation !== null) {
      return (
        <section className="bg-emerald-950/40 border border-emerald-800 rounded-xl p-4 text-sm text-emerald-300">
          You donated ${data.myDonation.toLocaleString()} toward {data.requesters.map((r) => r.regionId).join(", ")}&apos;s request.
        </section>
      );
    }
    return (
      <section className="bg-purple-950/40 border-2 border-purple-700 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-purple-300">
          {data.requesters.map((r) => `${r.regionId} ($${(r.requestedAmount ?? 0).toLocaleString()})`).join(", ")} requested extra funding this cycle. Donate part of your own ${data.myDefaultAmount?.toLocaleString()} disbursement, or donate $0.
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={data.myDefaultAmount ?? undefined}
            value={donationAmount}
            onChange={(e) => setDonationAmount(e.target.value)}
            placeholder="Donation amount"
            className="rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm w-40"
          />
          <button
            onClick={() => donate.mutate(Number(donationAmount) || 0)}
            disabled={donate.isPending || Number(donationAmount) < 0}
            className="rounded-md bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white text-sm font-medium px-4 py-2"
          >
            Confirm Donation
          </button>
        </div>
      </section>
    );
  }

  return null;
}
