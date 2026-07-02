"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { ProfileSections } from "@/components/profile-sections";
import Link from "next/link";

interface OrientationData {
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

export default function OrientationPage() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<OrientationData>("/api/dashboard"),
  });

  const region = data?.ownRegion;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Welcome to</p>
        <h1 className="text-2xl font-semibold">Operation Veiled Horizon</h1>
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">The Scenario</h2>
        <p>
          A novel betacoronavirus (NCoV-X1) has emerged. Day 14 since the first case, and the WHO Emergency
          Committee is meeting for the first time to consider a PHEIC declaration. Human-to-human transmission is
          confirmed in 3 countries across 2 regions. The pathogen&apos;s origin — natural spillover vs. lab-adjacent —
          is deliberately unresolved; you will never be told a &quot;correct answer&quot; on that question, in-game or
          otherwise.
        </p>
        <p>
          Over the course of this session, WHO headquarters and all six regional offices (including yours) will
          face a series of decision events: some affect only your region, some are global and require every team to
          respond, and a few explicitly require coordinating with other regions before you submit. Every decision is
          scored across three weighted dimensions — evidence-based practice, political/economic realism, and health
          equity — and the outcome changes the live model of the outbreak that everyone can see on the shared
          dashboard.
        </p>
      </section>

      {region && (
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Your Role: {region.roleTitle}</h2>
            <p className="text-sm text-slate-500">{region.hqLocation}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            <Stat label="Fund" value={`$${(region.fundRemaining / 1_000_000).toFixed(1)}M`} />
            <Stat label="PPE days" value={region.ppeDaysRemaining} />
            <Stat label="Antivirals" value={region.antiviralsRemaining.toLocaleString()} />
            <Stat label="HCW surge" value={`${region.hcwSurgePct}%`} />
            <Stat label="Surveillance" value={`${region.surveillanceIndex}/10`} />
            <Stat label="Starting Rt" value={region.rt.toFixed(2)} />
            <Stat label="Starting CFR mult." value={`${region.cfrMultiplier.toFixed(2)}x`} />
          </div>

          <div className="pt-2 border-t border-slate-800">
            <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Briefing</p>
            <ProfileSections markdown={region.profileMarkdown} />
          </div>
        </section>
      )}

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-100">Where to Find Things</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="font-medium text-slate-200">Situation Room</p>
            <p className="text-slate-400">
              The shared global dashboard everyone sees, plus your own team&apos;s private resource ledger (funds,
              PPE, tension, trust) layered on top. Check this often — it updates as decisions get scored.
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-200">Events</p>
            <p className="text-slate-400">
              Anything dispatched to your team shows up here with a countdown to its deadline. Click into one to
              read the narrative and submit your structured choice + written rationale.
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-200">Coordination</p>
            <p className="text-slate-400">
              A shared message log visible to all teams and the instructor. Several events explicitly reward (or
              require) coordinating here before you submit — use it.
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-200">Profile</p>
            <p className="text-slate-400">
              Your region&apos;s full briefing — starting resources, geopolitical context, and strategic priorities —
              available any time you need to double check the details.
            </p>
          </div>
          <div>
            <p className="font-medium text-slate-200">Pledges</p>
            <p className="text-slate-400">
              Pledge PPE, funds, antivirals, or HCW surge capacity directly to another region — it actually moves
              resources between regions&apos; live ledgers, not just a note in a rationale field.
            </p>
          </div>
        </div>
      </section>

      <p className="text-xs text-slate-500">
        Note: once the simulation is running, regional Rt drifts upward slowly on its own if no fresh containment
        decision has been scored for a while — time itself has a cost, not just individual bad decisions.
      </p>

      <Link
        href="/dashboard"
        className="inline-block rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5"
      >
        Continue to Situation Room
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  );
}
