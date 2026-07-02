"use client";

import { useEffect, useState } from "react";

// Ticks locally every second between polls (same pattern as SimClock /
// snap-vote countdowns) so multiple concurrent countdowns on one screen
// (e.g. the Control page's Active Deadlines panel) all stay smooth without
// each one needing its own network poll.
export function DeadlineCountdown({ deadlineAt, className }: { deadlineAt: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = new Date(deadlineAt).getTime() - now;
  const expired = remainingMs <= 0;
  const minutes = Math.max(0, Math.floor(remainingMs / 60000));
  const seconds = Math.max(0, Math.floor((remainingMs % 60000) / 1000));

  return (
    <span className={className ?? (expired ? "text-red-400" : "text-amber-400")}>
      {expired ? "Deadline passed" : `${minutes}m ${String(seconds).padStart(2, "0")}s`}
    </span>
  );
}
