"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { QueryError } from "@/components/query-error";
import { REGIONS } from "@/lib/regions";
import { Chip } from "@/components/ui/chip";
import { PillButton } from "@/components/ui/pill-button";

interface MarketData {
  prices: { PPE_DAYS: number; ANTIVIRALS: number };
  whoHqPpeStock: number;
  whoHqAntiviralsStock: number;
  requests: { id: number; regionId: string; resourceType: string; amount: number; totalCost: number; status: string; createdAt: string }[];
}

interface TradeOffer {
  id: number;
  fromRegionId: string;
  toRegionId: string;
  resourceType: string;
  amount: number;
  totalPrice: number;
  status: string;
  createdAt: string;
}

interface DashboardData {
  ownRegion: { regionId: string } | null;
}

const RESOURCE_LABEL: Record<string, string> = { PPE_DAYS: "PPE (days)", ANTIVIRALS: "Antivirals (doses)" };

export default function MarketplacePage() {
  const qc = useQueryClient();
  const { data: dash } = useQuery({ queryKey: ["dashboard"], queryFn: () => apiFetch<DashboardData>("/api/dashboard") });

  const { data: market, error: marketError, refetch: refetchMarket } = useQuery({
    queryKey: ["market"],
    queryFn: () => apiFetch<MarketData>("/api/market"),
    refetchInterval: 5000,
  });
  const { data: trades } = useQuery({
    queryKey: ["trade"],
    queryFn: () => apiFetch<{ offers: TradeOffer[] }>("/api/trade"),
    refetchInterval: 5000,
  });

  const [buyResource, setBuyResource] = useState<"PPE_DAYS" | "ANTIVIRALS">("PPE_DAYS");
  const [buyAmount, setBuyAmount] = useState("");
  const [buyError, setBuyError] = useState<string | null>(null);

  const [tradeTo, setTradeTo] = useState("");
  const [tradeResource, setTradeResource] = useState<"PPE_DAYS" | "ANTIVIRALS">("PPE_DAYS");
  const [tradeAmount, setTradeAmount] = useState("");
  const [tradePrice, setTradePrice] = useState("");
  const [tradeError, setTradeError] = useState<string | null>(null);

  const buyFromWho = useMutation({
    mutationFn: () => apiFetch("/api/market", { method: "POST", body: JSON.stringify({ resourceType: buyResource, amount: Number(buyAmount) }) }),
    onSuccess: () => {
      setBuyAmount("");
      setBuyError(null);
      qc.invalidateQueries({ queryKey: ["market"] });
    },
    onError: (e: Error) => setBuyError(e.message),
  });

  const proposeTrade = useMutation({
    mutationFn: () =>
      apiFetch("/api/trade", {
        method: "POST",
        body: JSON.stringify({ toRegionId: tradeTo, resourceType: tradeResource, amount: Number(tradeAmount), pricePerUnit: Number(tradePrice) }),
      }),
    onSuccess: () => {
      setTradeAmount("");
      setTradePrice("");
      setTradeError(null);
      qc.invalidateQueries({ queryKey: ["trade"] });
    },
    onError: (e: Error) => setTradeError(e.message),
  });

  const respondTrade = useMutation({
    mutationFn: ({ offerId, action }: { offerId: number; action: "accept" | "reject" }) =>
      apiFetch("/api/trade", { method: "PATCH", body: JSON.stringify({ offerId, action }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trade"] }),
  });

  if (marketError) return <QueryError error={marketError} onRetry={() => refetchMarket()} label="marketplace" />;

  const ownRegion = dash?.ownRegion?.regionId;
  const incomingOffers = (trades?.offers ?? []).filter((o) => o.toRegionId === ownRegion && o.status === "pending");
  const recentBatch = (market?.requests ?? []).filter((r) => r.status === "pending");

  const tradeStatusTone = { accepted: "sage-soft", rejected: "neutral-outline", pending: "accent-soft" } as const;

  return (
    <div className="flex max-w-4xl flex-col gap-[26px]">
      <div>
        <h1 className="font-heading text-[32px] text-text">Marketplace</h1>
        <p className="mt-1 text-sm text-neutral-700">
          Buy PPE or antivirals from WHO HQ at the current adaptive price (requires instructor approval — other
          regions get a 30-second heads-up to submit their own request before it&apos;s processed), or trade directly
          with another region. Trades are accept/reject only, no counter-offers.
        </p>
      </div>

      <section className="space-y-4 rounded-lg bg-surface p-5">
        <h2 className="font-heading text-[21px] text-text">WHO HQ Marketplace</h2>
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-md bg-bg p-3">
            <p className="text-xs text-neutral-600">PPE (per day-equivalent unit)</p>
            <p className="text-base font-bold text-text">${market?.prices.PPE_DAYS.toLocaleString()}</p>
            <p className="mt-1 text-xs text-neutral-600">WHO HQ stock: {market?.whoHqPpeStock.toLocaleString()}</p>
          </div>
          <div className="rounded-md bg-bg p-3">
            <p className="text-xs text-neutral-600">Antivirals (per dose)</p>
            <p className="text-base font-bold text-text">${market?.prices.ANTIVIRALS.toLocaleString()}</p>
            <p className="mt-1 text-xs text-neutral-600">WHO HQ stock: {market?.whoHqAntiviralsStock.toLocaleString()}</p>
          </div>
        </div>
        <p className="text-xs text-neutral-600">Prices rise as WHO HQ&apos;s own stock depletes and as the global escalation state worsens — waiting to buy is a real gamble.</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (Number(buyAmount) > 0) buyFromWho.mutate();
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="text-sm">
            Resource
            <select value={buyResource} onChange={(e) => setBuyResource(e.target.value as "PPE_DAYS" | "ANTIVIRALS")} className="mt-1 block rounded-full border-2 border-divider bg-bg px-4 py-2">
              <option value="PPE_DAYS">PPE (days)</option>
              <option value="ANTIVIRALS">Antivirals (doses)</option>
            </select>
          </label>
          <label className="text-sm">
            Amount
            <input type="number" min={1} value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)} className="mt-1 block w-32 rounded-full border-2 border-divider bg-bg px-4 py-2" />
          </label>
          <PillButton type="submit" disabled={buyFromWho.isPending} tone="accent">
            {buyFromWho.isPending ? "Submitting..." : "Request Purchase"}
          </PillButton>
          {buyAmount && market && (
            <span className="text-xs text-neutral-600">≈ ${Math.round(Number(buyAmount) * (market.prices[buyResource] ?? 0)).toLocaleString()} total</span>
          )}
        </form>
        {buyError && <p className="text-sm font-medium text-accent-800">{buyError}</p>}

        {recentBatch.length > 0 && (
          <div className="space-y-1 text-xs text-neutral-700">
            <p className="uppercase tracking-wide text-neutral-600">Pending this batch (awaiting instructor approval)</p>
            {recentBatch.map((r) => (
              <p key={r.id}>{r.regionId}: {r.amount.toLocaleString()} {RESOURCE_LABEL[r.resourceType]} — ${r.totalCost.toLocaleString()}</p>
            ))}
          </div>
        )}
      </section>

      {incomingOffers.length > 0 && (
        <section className="space-y-3 rounded-lg bg-accent-100 p-5">
          <h2 className="font-heading text-[21px] text-accent-900">Incoming Trade Offers</h2>
          {incomingOffers.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-3 rounded-lg bg-bg p-3 text-sm">
              <span className="text-text">
                {o.fromRegionId} offers ${o.totalPrice.toLocaleString()} for {o.amount.toLocaleString()} {RESOURCE_LABEL[o.resourceType]}
              </span>
              <div className="flex shrink-0 gap-2">
                <PillButton size="sm" tone="sage" onClick={() => respondTrade.mutate({ offerId: o.id, action: "accept" })}>Accept</PillButton>
                <PillButton size="sm" tone="ghost" onClick={() => respondTrade.mutate({ offerId: o.id, action: "reject" })}>Reject</PillButton>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-4 rounded-lg bg-surface p-5">
        <h2 className="font-heading text-[21px] text-text">Propose a Direct Trade</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (tradeTo && Number(tradeAmount) > 0 && Number(tradePrice) > 0) proposeTrade.mutate();
          }}
          className="grid gap-3 sm:grid-cols-4"
        >
          <label className="text-sm">
            From region
            <select value={tradeTo} onChange={(e) => setTradeTo(e.target.value)} className="mt-1 block w-full rounded-full border-2 border-divider bg-bg px-4 py-2">
              <option value="" disabled>Select region</option>
              {REGIONS.filter((r) => r !== ownRegion).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Resource
            <select value={tradeResource} onChange={(e) => setTradeResource(e.target.value as "PPE_DAYS" | "ANTIVIRALS")} className="mt-1 block w-full rounded-full border-2 border-divider bg-bg px-4 py-2">
              <option value="PPE_DAYS">PPE (days)</option>
              <option value="ANTIVIRALS">Antivirals (doses)</option>
            </select>
          </label>
          <label className="text-sm">
            Amount
            <input type="number" min={1} value={tradeAmount} onChange={(e) => setTradeAmount(e.target.value)} className="mt-1 block w-full rounded-full border-2 border-divider bg-bg px-4 py-2" />
          </label>
          <label className="text-sm">
            Price per unit
            <input type="number" min={1} value={tradePrice} onChange={(e) => setTradePrice(e.target.value)} className="mt-1 block w-full rounded-full border-2 border-divider bg-bg px-4 py-2" />
          </label>
          <PillButton type="submit" disabled={proposeTrade.isPending} tone="accent" className="sm:col-span-4">
            {proposeTrade.isPending ? "Sending..." : "Propose Trade"}
          </PillButton>
        </form>
        {tradeError && <p className="text-sm font-medium text-accent-800">{tradeError}</p>}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-text">Recent Trades</h2>
        <div className="space-y-2">
          {(trades?.offers ?? []).map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-lg bg-surface p-3 text-sm">
              <span className="text-text">
                {o.fromRegionId} → {o.toRegionId}: {o.amount.toLocaleString()} {RESOURCE_LABEL[o.resourceType]} for ${o.totalPrice.toLocaleString()}
              </span>
              <Chip tone={tradeStatusTone[o.status as keyof typeof tradeStatusTone] ?? "neutral-soft"}>{o.status}</Chip>
            </div>
          ))}
          {(!trades || trades.offers.length === 0) && <p className="text-sm text-neutral-600">No trades yet.</p>}
        </div>
      </section>
    </div>
  );
}
