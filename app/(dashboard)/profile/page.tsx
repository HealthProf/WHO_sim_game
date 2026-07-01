"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";

export default function ProfilePage() {
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<{ ownRegion: { profileMarkdown: string; roleTitle: string; hqLocation: string } | null }>("/api/dashboard"),
  });

  if (!data?.ownRegion) return <p className="text-slate-400">Loading profile...</p>;

  return (
    <div className="max-w-2xl space-y-3">
      <h2 className="text-xl font-semibold">{data.ownRegion.roleTitle}</h2>
      <p className="text-sm text-slate-500">{data.ownRegion.hqLocation}</p>
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 text-sm text-slate-300 whitespace-pre-wrap">
        {data.ownRegion.profileMarkdown}
      </div>
    </div>
  );
}
