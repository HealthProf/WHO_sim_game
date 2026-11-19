"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import type { FeatureUnlockState, GatedFeature } from "@/lib/feature-unlock";

// Shows a friendly "opens after N events" notice instead of a feature's page
// while it's still locked by the phased unlock (lib/feature-unlock.ts). The
// API enforces the same lock, so this is presentation only. While the
// dashboard is loading, the children render (nothing can be submitted to a
// locked feature anyway).
export function FeatureLockNotice({ feature, children }: { feature: GatedFeature; children: ReactNode }) {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<{ featureUnlocks?: Record<GatedFeature, FeatureUnlockState> }>("/api/dashboard"),
    refetchInterval: 15000,
  });
  const state = data?.featureUnlocks?.[feature];
  if (state && !state.open) {
    return (
      <section className="rounded-lg border-2 border-dashed border-neutral-400 bg-surface p-6 text-neutral-800">
        <p className="flex items-center gap-2 font-semibold text-text">
          <LockIcon /> Not open yet
        </p>
        <p className="mt-1 text-sm">{state.message}</p>
      </section>
    );
  }
  return <>{children}</>;
}

export function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}
