"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { QueryError } from "@/components/query-error";
import { ProfileSections } from "@/components/profile-sections";
import { TeamSnapVoteBanner } from "@/components/snap-vote-banner";
import { BudgetCycleBanner } from "@/components/budget-cycle-banner";
import { RecentDevelopments } from "@/components/recent-developments";

interface DashboardData {
  globalState: { currentDay: number; escalationState: "GREEN" | "AMBER" | "RED"; mediaPressureIndex: number; simulationStatus: string };
  globalRt: number;
  sharedSummary: {
    regionId: string;
    fullName: string;
    confirmedCases: number;
    estimatedTrueCasesLow: number;
    estimatedTrueCasesHigh: number;
    deaths: number;
    rt: number;
    hospitalCapacityPct: number;
    surveillanceIndex: number;
  }[];
  ownRegion: {
    regionId: string;
    day: number;
    rt: number;
    cfrMultiplier: number;
    fundRemaining: number;
    ppeDaysRemaining: number;
    antiviralsRemaining: number;
    hcwSurgePct: number;
    politicalTensionIndex: number;
    publicTrustIndex: number;
    populationHappinessIndex: number;
    profileMarkdown: string;
    roleTitle: string;
    hqLocation: string;
  } | null;
  notifications: { id: number; kind: string; message: string; createdAt: string }[];
  globalAvgHappiness: number;
  globalAvgPublicTrust: number;
}

const escalationColor: Record<string, string> = {
  GREEN: "bg-emerald-600",
  AMBER: "bg-amber-500",
  RED: "bg-red-600",
};

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardData>("/api/dashboard"),
    refetchInterval: 15000,
  });

  if (error) return <QueryError error={error} onRetry={() => refetch()} label="situation room" />;
  if (isLoading || !data) return <p className="text-slate-400">Loading situation room...</p>;

  return (
    <div className="space-y-8">
      <TeamSnapVoteBanner />
      <BudgetCycleBanner />

      <section className="flex items-center gap-4">
        <span className={`px-3 py-1 rounded-full text-xs font-semibold text-white ${escalationColor[data.globalState.escalationState]}`}>
          {data.globalState.escalationState}
        </span>
        <span className="text-sm text-slate-400">Day {data.globalState.currentDay}</span>
        <span className="text-sm text-slate-400">Global Rt: {data.globalRt.toFixed(2)}</span>
        <span className="text-sm text-slate-400">Media Pressure: {data.globalState.mediaPressureIndex}</span>
        <span className="text-sm text-slate-400">Global Avg. Public Trust: {data.globalAvgPublicTrust}</span>
        <span className="text-sm text-slate-400">Global Avg. Happiness: {data.globalAvgHappiness}</span>
        <span className="text-sm text-slate-500 ml-auto capitalize">{data.globalState.simulationStatus.replace("_", " ")}</span>
      </section>
      <p className="text-xs text-slate-500 -mt-6">
        Rt drifts upward slowly on its own while the sim is running and no fresh containment decision has landed — idle time has a cost too.
      </p>

      {data.notifications.length > 0 && <RecentDevelopments notifications={data.notifications} />}

      {data.ownRegion && (
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-1">{data.ownRegion.roleTitle}</h2>
          <p className="text-sm text-slate-400 mb-4">{data.ownRegion.hqLocation}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 text-sm">
            <Stat label="Fund" value={`$${(data.ownRegion.fundRemaining / 1_000_000).toFixed(1)}M`} />
            <Stat label="PPE days" value={data.ownRegion.ppeDaysRemaining} />
            <Stat label="Antivirals" value={data.ownRegion.antiviralsRemaining.toLocaleString()} />
            <Stat label="HCW surge" value={`${data.ownRegion.hcwSurgePct}%`} />
            <Stat label="Rt" value={data.ownRegion.rt.toFixed(2)} />
            <Stat label="CFR multiplier" value={data.ownRegion.cfrMultiplier.toFixed(2)} />
            <Stat label="Political tension" value={data.ownRegion.politicalTensionIndex} />
            <Stat label="Public trust" value={data.ownRegion.publicTrustIndex} />
            <Stat label="Population happiness" value={data.ownRegion.populationHappinessIndex} />
          </div>
          <details className="text-sm text-slate-300">
            <summary className="cursor-pointer text-slate-400">Full regional profile</summary>
            <div className="mt-3">
              <ProfileSections markdown={data.ownRegion.profileMarkdown} />
            </div>
          </details>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-3">Global Situation Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-800">
                <th className="py-2 pr-4">Region</th>
                <th className="py-2 pr-4">Confirmed</th>
                <th className="py-2 pr-4">Est. True</th>
                <th className="py-2 pr-4">Deaths</th>
                <th className="py-2 pr-4">Rt</th>
                <th className="py-2 pr-4">Capacity Used</th>
                <th className="py-2 pr-4">Surveillance</th>
              </tr>
            </thead>
            <tbody>
              {data.sharedSummary.map((r) => (
                <tr key={r.regionId} className="border-b border-slate-900">
                  <td className="py-2 pr-4 font-medium">{r.regionId}</td>
                  <td className="py-2 pr-4">{r.confirmedCases}</td>
                  <td className="py-2 pr-4">{r.estimatedTrueCasesLow}-{r.estimatedTrueCasesHigh}</td>
                  <td className="py-2 pr-4">{r.deaths}</td>
                  <td className="py-2 pr-4">{r.rt.toFixed(2)}</td>
                  <td className="py-2 pr-4">{r.hospitalCapacityPct}%</td>
                  <td className="py-2 pr-4">{r.surveillanceIndex}/10</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
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
