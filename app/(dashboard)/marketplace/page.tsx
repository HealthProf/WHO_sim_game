"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { QueryError } from "@/components/query-error";

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

const REGIONS = ["AFRO", "AMRO", "EMRO", "EURO", "SEARO", "WPRO"];
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

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Marketplace</h2>
        <p className="text-sm text-slate-400 mt-1">
          Buy PPE or antivirals from WHO HQ at the current adaptive price (requires instructor approval — other
          regions get a 30-second heads-up to submit their own request before it&apos;s processed), or trade directly
          with another region. Trades are accept/reject only, no counter-offers.
        </p>
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="font-medium">WHO HQ Marketplace</h3>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-xs text-slate-500">PPE (per day-equivalent unit)</p>
            <p className="text-base font-semibold">${market?.prices.PPE_DAYS.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">WHO HQ stock: {market?.whoHqPpeStock.toLocaleString()}</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Antivirals (per dose)</p>
            <p className="text-base font-semibold">${market?.prices.ANTIVIRALS.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">WHO HQ stock: {market?.whoHqAntiviralsStock.toLocaleString()}</p>
          </div>
        </div>
        <p className="text-xs text-slate-500">Prices rise as WHO HQ&apos;s own stock depletes and as the global escalation state worsens — waiting to buy is a real gamble.</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (Number(buyAmount) > 0) buyFromWho.mutate();
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="text-sm">
            Resource
            <select value={buyResource} onChange={(e) => setBuyResource(e.target.value as "PPE_DAYS" | "ANTIVIRALS")} className="mt-1 block rounded-md bg-slate-800 border border-slate-700 px-2 py-2">
              <option value="PPE_DAYS">PPE (days)</option>
              <option value="ANTIVIRALS">Antivirals (doses)</option>
            </select>
          </label>
          <label className="text-sm">
            Amount
            <input type="number" min={1} value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)} className="mt-1 block rounded-md bg-slate-800 border border-slate-700 px-2 py-2 w-32" />
          </label>
          <button type="submit" disabled={buyFromWho.isPending} className="rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2">
            {buyFromWho.isPending ? "Submitting..." : "Request Purchase"}
          </button>
          {buyAmount && market && (
            <span className="text-xs text-slate-400">≈ ${Math.round(Number(buyAmount) * (market.prices[buyResource] ?? 0)).toLocaleString()} total</span>
          )}
        </form>
        {buyError && <p className="text-sm text-red-400">{buyError}</p>}

        {recentBatch.length > 0 && (
          <div className="text-xs text-slate-400 space-y-1">
            <p className="text-slate-500 uppercase tracking-wide">Pending this batch (awaiting instructor approval)</p>
            {recentBatch.map((r) => (
              <p key={r.id}>{r.regionId}: {r.amount.toLocaleString()} {RESOURCE_LABEL[r.resourceType]} — ${r.totalCost.toLocaleString()}</p>
            ))}
          </div>
        )}
      </section>

      {incomingOffers.length > 0 && (
        <section className="bg-amber-950/40 border border-amber-700 rounded-xl p-5 space-y-3">
          <h3 className="font-medium text-amber-300">Incoming Trade Offers</h3>
          {incomingOffers.map((o) => (
            <div key={o.id} className="flex items-center justify-between gap-3 text-sm bg-slate-900/60 rounded-lg p-3">
              <span>
                {o.fromRegionId} offers ${o.totalPrice.toLocaleString()} for {o.amount.toLocaleString()} {RESOURCE_LABEL[o.resourceType]}
              </span>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => respondTrade.mutate({ offerId: o.id, action: "accept" })} className="rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5">Accept</button>
                <button onClick={() => respondTrade.mutate({ offerId: o.id, action: "reject" })} className="rounded-md bg-red-700 hover:bg-red-600 text-white text-xs px-3 py-1.5">Reject</button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="font-medium">Propose a Direct Trade</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (tradeTo && Number(tradeAmount) > 0 && Number(tradePrice) > 0) proposeTrade.mutate();
          }}
          className="grid sm:grid-cols-4 gap-3"
        >
          <label className="text-sm">
            From region
            <select value={tradeTo} onChange={(e) => setTradeTo(e.target.value)} className="mt-1 block w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2">
              <option value="" disabled>Select region</option>
              {REGIONS.filter((r) => r !== ownRegion).map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Resource
            <select value={tradeResource} onChange={(e) => setTradeResource(e.target.value as "PPE_DAYS" | "ANTIVIRALS")} className="mt-1 block w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2">
              <option value="PPE_DAYS">PPE (days)</option>
              <option value="ANTIVIRALS">Antivirals (doses)</option>
            </select>
          </label>
          <label className="text-sm">
            Amount
            <input type="number" min={1} value={tradeAmount} onChange={(e) => setTradeAmount(e.target.value)} className="mt-1 block w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2" />
          </label>
          <label className="text-sm">
            Price per unit
            <input type="number" min={1} value={tradePrice} onChange={(e) => setTradePrice(e.target.value)} className="mt-1 block w-full rounded-md bg-slate-800 border border-slate-700 px-2 py-2" />
          </label>
          <button type="submit" disabled={proposeTrade.isPending} className="sm:col-span-4 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2">
            {proposeTrade.isPending ? "Sending..." : "Propose Trade"}
          </button>
        </form>
        {tradeError && <p className="text-sm text-red-400">{tradeError}</p>}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-300 mb-2">Recent Trades</h3>
        <div className="space-y-2">
          {(trades?.offers ?? []).map((o) => (
            <div key={o.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm flex items-center justify-between">
              <span>
                {o.fromRegionId} → {o.toRegionId}: {o.amount.toLocaleString()} {RESOURCE_LABEL[o.resourceType]} for ${o.totalPrice.toLocaleString()}
              </span>
              <span className={`text-xs uppercase ${o.status === "accepted" ? "text-emerald-400" : o.status === "rejected" ? "text-red-400" : "text-amber-400"}`}>{o.status}</span>
            </div>
          ))}
          {(!trades || trades.offers.length === 0) && <p className="text-slate-500 text-sm">No trades yet.</p>}
        </div>
      </section>
    </div>
  );
}
