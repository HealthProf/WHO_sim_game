// Team-facing event status (Release 1): to do / submitted / scored, in
// colorblind-safe colors with an icon and a word on every badge, so color is
// never the only signal. "closed" (deadline passed, consequence applied
// automatically) is a finished state, shown like "scored".
export type TeamEventStatus = "todo" | "submitted" | "done";

export function teamStatusOf(dispatchStatus: string): TeamEventStatus {
  if (dispatchStatus === "dispatched") return "todo";
  if (dispatchStatus === "responded") return "submitted";
  return "done";
}

const LABEL: Record<string, string> = {
  dispatched: "To do",
  responded: "Submitted, awaiting score",
  scored: "Scored",
  closed: "Closed, deadline passed",
};

const BADGE_CLASS: Record<TeamEventStatus, string> = {
  todo: "bg-status-todo-soft text-status-todo-ink",
  submitted: "bg-status-pending-soft text-status-pending-ink",
  done: "bg-neutral-200 text-neutral-800",
};

// A thick left edge on list cards, so status reads at a glance down a list.
export const STATUS_EDGE_CLASS: Record<TeamEventStatus, string> = {
  todo: "border-l-[6px] border-status-todo",
  submitted: "border-l-[6px] border-status-pending",
  done: "border-l-[6px] border-neutral-400",
};

export function EventStatusBadge({ status }: { status: string }) {
  const s = teamStatusOf(status);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${BADGE_CLASS[s]}`}>
      <StatusIcon status={s} />
      {LABEL[status] ?? status}
    </span>
  );
}

function StatusIcon({ status }: { status: TeamEventStatus }) {
  if (status === "todo") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }
  if (status === "submitted") {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M6 1.5 A4.5 4.5 0 0 1 6 10.5 Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M2 6.5 L5 9.5 L10.5 3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
