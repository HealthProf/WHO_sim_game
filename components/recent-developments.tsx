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
    market: "Marketplace",
    trade: "Trade",
    budget_cycle: "Budget Cycle",
    emergency_funding: "Emergency Funding",
    decision_revealed: "Decision Revealed",
    stakeholder: "Stakeholder",
    interjection: "Facilitator",
    leak: "Leak",
  };
  const kindColor: Record<string, string> = {
    consequence: "text-neutral-700",
    snap_vote: "text-accent-700",
    pledge: "text-accent-2-700",
    market: "text-accent-700",
    trade: "text-accent-700",
    budget_cycle: "text-neutral-700",
    emergency_funding: "text-accent-700",
    decision_revealed: "text-neutral-700",
    stakeholder: "text-accent-2-700",
    interjection: "text-accent-700",
    leak: "text-accent-800",
  };

  return (
    <section className="rounded-lg bg-surface p-5">
      <h2 className="mb-3 text-sm font-bold text-text">Recent Developments</h2>
      <div className="max-h-56 space-y-2 overflow-y-auto">
        {notifications.map((n) => (
          <div key={n.id} className="text-sm">
            <span className={`mr-2 text-xs font-semibold uppercase ${kindColor[n.kind] ?? "text-neutral-700"}`}>
              {kindLabel[n.kind] ?? n.kind}
            </span>
            <span className="text-neutral-800">{n.message}</span>
            <span className="ml-2 text-xs text-neutral-700">{new Date(n.createdAt).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
