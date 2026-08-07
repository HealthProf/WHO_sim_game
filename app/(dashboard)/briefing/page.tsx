"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { ProfileSections } from "@/components/profile-sections";
import { KeyTerms } from "@/components/key-terms";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TierChip } from "@/components/ui/chip";
import { PillLink } from "@/components/ui/pill-button";
import { glossaryTerms } from "@/lib/db/seed-data/glossary";

const SCENARIO_PARAGRAPH_1 =
  "A novel betacoronavirus (NCoV-X1) has emerged. Day 14 since the first case, and the WHO Emergency Committee is meeting for the first time to consider a PHEIC declaration. Human-to-human transmission is confirmed in 3 countries across 2 regions. The pathogen's origin — natural spillover vs. lab-adjacent — is deliberately unresolved; you will never be told a \"correct answer\" on that question, in-game or otherwise.";
const SCENARIO_PARAGRAPH_2 =
  "Over the course of this session, WHO headquarters and all six regional offices (including yours) will face a series of decision events: some affect only your region, some are global and require every team to respond, and a few explicitly require coordinating with other regions before you submit. Every decision is scored across three weighted dimensions — evidence-based practice, political/economic realism, and health equity — and the outcome changes the live model of the outbreak (Rt, CFR, escalation state) that everyone can see on the shared dashboard.";

interface BriefingData {
  ownRegion: {
    regionId: string;
    roleTitle: string;
    hqLocation: string;
    profileMarkdown: string;
    rt: number;
    cfrMultiplier: number;
    fundRemaining: number;
    ppeDaysRemaining: number;
    antiviralsRemaining: number;
    hcwSurgePct: number;
    surveillanceIndex: number;
  } | null;
}

const TABS = [
  { value: "region", label: "Your region" },
  { value: "scenario", label: "The scenario" },
  { value: "scoring", label: "How you're scored" },
  { value: "glossary", label: "Glossary" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export default function BriefingPage() {
  const [tab, setTab] = useState<Tab>("region");
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<BriefingData>("/api/dashboard"),
  });
  const region = data?.ownRegion;

  return (
    <div className="flex max-w-3xl flex-col gap-[26px]">
      <h1 className="font-heading text-[32px] text-text">Briefing</h1>
      <SegmentedControl options={TABS as unknown as { value: Tab; label: string }[]} value={tab} onChange={setTab} />

      {tab === "region" && (
        <>
          {region ? (
            <section className="space-y-4 rounded-lg bg-surface p-5">
              <div>
                <h2 className="font-heading text-[21px] text-text">{region.roleTitle}</h2>
                <p className="text-sm text-neutral-700">{region.hqLocation}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Stat label="Fund" value={`$${(region.fundRemaining / 1_000_000).toFixed(1)}M`} />
                <Stat label="PPE days" value={region.ppeDaysRemaining} />
                <Stat label="Antivirals" value={region.antiviralsRemaining.toLocaleString()} />
                <Stat label="HCW surge" value={`${region.hcwSurgePct}%`} />
                <Stat label="Surveillance" value={`${region.surveillanceIndex}/10`} />
                <Stat label="Starting Rt" value={region.rt.toFixed(2)} />
                <Stat label="Starting CFR mult." value={`${region.cfrMultiplier.toFixed(2)}x`} />
              </div>
              <div className="border-t border-divider pt-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-neutral-700">Briefing</p>
                <ProfileSections markdown={region.profileMarkdown} />
              </div>
            </section>
          ) : (
            <p className="text-neutral-700">Loading your region&apos;s briefing...</p>
          )}
        </>
      )}

      {tab === "scenario" && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-700">Welcome to</p>
              <h2 className="font-heading text-[21px] text-text">Operation Veiled Horizon</h2>
            </div>
            <Link href="/orientation/slides" className="whitespace-nowrap text-sm font-medium text-accent-700 hover:text-accent-600">
              Slide deck version →
            </Link>
          </div>

          <section className="space-y-3 rounded-lg bg-surface p-5 text-sm text-neutral-800">
            <p>{SCENARIO_PARAGRAPH_1}</p>
            <p>{SCENARIO_PARAGRAPH_2}</p>
          </section>

          <KeyTerms texts={[SCENARIO_PARAGRAPH_1, SCENARIO_PARAGRAPH_2]} />

          <section className="space-y-4 rounded-lg bg-surface p-5">
            <h2 className="font-heading text-[21px] text-text">Where to Find Things</h2>
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <FindThing title="Situation" body="The shared global dashboard everyone sees, plus your own team's private resource ledger — always visible in the rail. Check this often; it updates as decisions get scored." />
              <FindThing title="Events" body="Anything dispatched to your team shows up here with a countdown to its deadline. Click into one to read the narrative and submit your structured choice + written rationale." />
              <FindThing title="Coordination" body="A shared message log visible to all teams and the instructor. Several events explicitly reward (or require) coordinating here before you submit — use it." />
              <FindThing title="Your region (this page)" body="Your region's full briefing — starting resources, geopolitical context, and strategic priorities — available any time you need to double check the details." />
              <FindThing title="Pledges" body="Pledge PPE, funds, antivirals, or HCW surge capacity directly to another region — it actually moves resources between regions' live ledgers, not just a note in a rationale field." />
            </div>
          </section>

          <p className="text-xs text-neutral-700">
            Note: once the simulation is running, regional Rt drifts upward slowly on its own if no fresh containment
            decision has been scored for a while — time itself has a cost, not just individual bad decisions.
          </p>

          <PillLink href="/dashboard" tone="accent" className="self-start">
            Continue to Situation Room
          </PillLink>
        </>
      )}

      {tab === "scoring" && (
        <section className="space-y-5 rounded-lg bg-surface p-5 text-sm text-neutral-800">
          <div>
            <h2 className="font-heading text-[21px] text-text">How you&apos;re scored</h2>
            <p className="mt-1 text-neutral-700">
              Every decision event that requires a team response is scored across three weighted dimensions by the
              instructor.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <ScoreDimension label="Evidence-Based Practice" weight="40%" body="Alignment with WHO/CDC guidelines and epidemiological literature." />
            <ScoreDimension label="Political & Economic Realism" weight="30%" body="Implementation feasibility, stakeholder engagement, legal/political constraints." />
            <ScoreDimension label="Health Equity" weight="30%" body="Impact on vulnerable populations and lower-resource regions." />
          </div>
          <div>
            <p className="mb-2 text-neutral-700">The weighted composite maps onto one of four consequence tiers, which drives how the shared outbreak model updates:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <TierRow tier="OPTIMAL" range="≥ 85%" />
              <TierRow tier="ADEQUATE" range="65–84%" />
              <TierRow tier="INADEQUATE" range="40–64%" />
              <TierRow tier="CRITICAL_FAILURE" range="< 40%" />
            </div>
          </div>
          <p className="text-xs text-neutral-700">
            You&apos;re never scored on whether a decision felt confident or safe — an INADEQUATE or CRITICAL FAILURE
            tier can still follow a well-argued rationale if the underlying choice doesn&apos;t hold up against the
            evidence, the politics, or the equity impact. That&apos;s deliberate: rationale quality doesn&apos;t
            substitute for the decision itself.
          </p>
        </section>
      )}

      {tab === "glossary" && (
        <section className="space-y-3">
          <p className="text-sm text-neutral-700">
            Plain-language explanations of every acronym and technical term used in this simulation. You&apos;ll also
            see a smaller &quot;Key Terms&quot; box on each event page showing just the handful of terms relevant to
            that specific decision.
          </p>
          <div className="space-y-3">
            {glossaryTerms.map((t) => (
              <div key={t.id} className="rounded-lg bg-surface p-4">
                <p className="font-semibold text-text">{t.term}</p>
                <p className="mt-1 text-sm text-neutral-700">{t.definition}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md bg-bg p-3">
      <p className="text-xs text-neutral-700">{label}</p>
      <p className="text-base font-bold text-text">{value}</p>
    </div>
  );
}

function FindThing({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="font-semibold text-text">{title}</p>
      <p className="text-neutral-700">{body}</p>
    </div>
  );
}

function ScoreDimension({ label, weight, body }: { label: string; weight: string; body: string }) {
  return (
    <div className="rounded-md bg-bg p-3">
      <div className="flex items-baseline justify-between">
        <p className="font-semibold text-text">{label}</p>
        <p className="text-sm font-bold text-accent-700">{weight}</p>
      </div>
      <p className="mt-1 text-xs text-neutral-700">{body}</p>
    </div>
  );
}

function TierRow({ tier, range }: { tier: string; range: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-bg p-3">
      <TierChip tier={tier} />
      <span className="text-sm text-neutral-700">{range}</span>
    </div>
  );
}
