"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { QueryError } from "@/components/query-error";
import { ProfileSections } from "@/components/profile-sections";

export default function ProfilePage() {
  const { data, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<{ ownRegion: { profileMarkdown: string; roleTitle: string; hqLocation: string } | null }>("/api/dashboard"),
  });

  if (error) return <QueryError error={error} onRetry={() => refetch()} label="profile" />;
  if (!data?.ownRegion) return <p className="text-slate-400">Loading profile...</p>;

  return (
    <div className="max-w-2xl space-y-3">
      <h2 className="text-xl font-semibold">{data.ownRegion.roleTitle}</h2>
      <p className="text-sm text-slate-500">{data.ownRegion.hqLocation}</p>
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
        <ProfileSections markdown={data.ownRegion.profileMarkdown} />
      </div>
    </div>
  );
}
