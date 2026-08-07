"use client";

import { useEffect, useState } from "react";
import { MONOLOGUE_MESSAGES, MONOLOGUE_MESSAGE_SECONDS } from "./cheat-codes";

export interface MonologueMessage {
  index: number;
  total: number;
  text: string;
}

// Cheat code #6's scripted message sequence needs to advance once every
// MONOLOGUE_MESSAGE_SECONDS, but dashboard/instructor pages only poll
// /api/dashboard every 15s (the projector polls /api/display every ~4s,
// which happens to be close enough to not obviously break, but isn't
// guaranteed to line up either). Deriving
// the current message purely from the last poll response meant most
// messages were simply never rendered — the client only ever showed
// whichever one happened to be "current" at the moment of a poll.
//
// Instead, this ticks its own local clock every second once it has a
// `startedAt` timestamp from the server, and recomputes the current message
// from elapsed real time — completely decoupled from poll cadence. A poll
// arriving late or early just means startedAt hasn't changed, so this
// keeps free-running from where it already was.
export function useMonologueMessage(startedAt: string | null | undefined): MonologueMessage | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (!startedAt) return null;

  const elapsedSec = (now - new Date(startedAt).getTime()) / 1000;
  const index = Math.min(MONOLOGUE_MESSAGES.length - 1, Math.max(0, Math.floor(elapsedSec / MONOLOGUE_MESSAGE_SECONDS)));
  return { index, total: MONOLOGUE_MESSAGES.length, text: MONOLOGUE_MESSAGES[index] };
}
