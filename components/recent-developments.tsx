// Private per-team feed of consequence cards, snap-vote results, and pledge
// notifications (see lib/consequences.ts / lib/snap-vote.ts / the pledges
// API) — surfaces "what just changed and why" instead of leaving teams to
// infer it from numbers moving on their own.
export function RecentDevelopments({ notifications }: { notifications: { id: number; kind: string; message: string; createdAt: string }[] }) {
  if (notifications.length === 0) return null;

  const kindLabel: Record<string, string> = {
    consequence: "Consequence",
    snap_vote: "Emergency Committee",
    pledge: "Pledge",
  };
  const kindColor: Record<string, string> = {
    consequence: "text-blue-400",
    snap_vote: "text-red-400",
    pledge: "text-emerald-400",
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-slate-200 mb-3">Recent Developments</h2>
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {notifications.map((n) => (
          <div key={n.id} className="text-sm">
            <span className={`text-xs font-semibold uppercase mr-2 ${kindColor[n.kind] ?? "text-slate-400"}`}>
              {kindLabel[n.kind] ?? n.kind}
            </span>
            <span className="text-slate-300">{n.message}</span>
            <span className="text-xs text-slate-600 ml-2">{new Date(n.createdAt).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
