"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/fetcher";
import { ARROW_GLYPHS, CHEAT_EXECUTE_DELAY_SECONDS, type CheatCodeKey } from "@/lib/cheat-codes";
import { useBarrelRollEffect } from "@/lib/use-barrel-roll";
import { useMonologueMessage } from "@/lib/use-monologue";

interface CheatDashboardData {
  cheat: {
    godModeActive: boolean;
    barrelRollAt: string | null;
    monologue: { index: number; total: number; text: string; secondsRemaining: number; startedAt: string } | null;
  };
  // Team dashboards already get cheat-triggered global messages via the
  // persistent per-team announcement modal (components/team-announcement-
  // modal.tsx); the instructor console has no equivalent watcher (it has no
  // teamId to key off), so this toast exists to cover that gap — see the
  // instructor-only render guard below.
  activeGlobalAnnouncement: { id: number; title: string; message: string; autoDismissSeconds: number | null } | null;
  actor: { role: "instructor" | "student" } | null;
}

interface AttemptResponse {
  result: "success" | "fail";
  codeKey?: CheatCodeKey;
  description?: string;
  noDisplay?: boolean;
}

type ModalState =
  | { kind: "closed" }
  | { kind: "entering" }
  | { kind: "fail" }
  // Distinct from "fail" — this is a request that never got a real answer
  // from the server (network drop, 401, 500, ...), not a wrong guess. Never
  // downgrade this to "fail": that indistinguishability is exactly what
  // made a broken deployment (e.g. the cheat_code_* tables missing because
  // `npm run db:push` hadn't been run against that database yet) look like
  // "every code is wrong" instead of "the feature is erroring."
  | { kind: "error"; message: string }
  | { kind: "success"; codeKey: CheatCodeKey; description: string; secondsLeft: number };

const ARROW_KEY_GLYPH: Record<string, string> = {
  ArrowUp: ARROW_GLYPHS.UP,
  ArrowDown: ARROW_GLYPHS.DOWN,
  ArrowLeft: ARROW_GLYPHS.LEFT,
  ArrowRight: ARROW_GLYPHS.RIGHT,
};

// The undiscoverable easter-egg entry point (see lib/cheat-codes.ts for what
// the codes actually do): a faint circular button in the bottom-right corner
// of every dashboard/instructor page, opening a code-entry box that accepts
// letters, digits, and arrow keys. Shares the ["dashboard"] query cache with
// the rail components already polling /api/dashboard at this layout level
// (components/team-rail.tsx, components/instructor-rail.tsx) — mounting
// this adds no extra network traffic.
//
// Also doubles as the receiver for two effects that are meant to be visible
// to *everyone*, not just whoever typed the code: the barrel-roll animation
// (lib/use-barrel-roll.ts) and the "one shot to rule them all" full-screen
// monologue takeover rendered at the bottom of this component.
export function CheatCodeWidget() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<CheatDashboardData>("/api/dashboard"),
    refetchInterval: 15000,
  });

  // Ticks locally every second from the server's startedAt timestamp,
  // independent of this page's 15s poll interval — see lib/use-monologue.ts
  // for why that decoupling matters (the poll cadence is far coarser than
  // the 5s-per-message cadence, so relying on the poll response's own
  // index/text directly meant most of the 9 messages were never shown).
  const monologue = useMonologueMessage(data?.cheat?.monologue?.startedAt);

  useBarrelRollEffect(data?.cheat?.barrelRollAt);

  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Drives the success screen's 5s execute countdown (see the task spec:
  // "code should execute 5 seconds after this screen appears"). The actual
  // effect only happens server-side once this reaches zero and POSTs to
  // /api/cheat/execute — nothing here applies game state directly.
  useEffect(() => {
    if (modal.kind !== "success") return;
    if (modal.secondsLeft <= 0) {
      apiFetch("/api/cheat/execute", { method: "POST", body: JSON.stringify({ codeKey: modal.codeKey }) })
        .catch((e) => console.error("cheat code execute failed:", e))
        .finally(() => {
          qc.invalidateQueries({ queryKey: ["dashboard"] });
          setModal({ kind: "closed" });
        });
      return;
    }
    const timeoutId = setTimeout(() => {
      setModal((m) => (m.kind === "success" ? { ...m, secondsLeft: m.secondsLeft - 1 } : m));
    }, 1000);
    return () => clearTimeout(timeoutId);
  }, [modal, qc]);

  function openModal() {
    setValue("");
    setModal({ kind: "entering" });
  }

  function closeModal() {
    setModal({ kind: "closed" });
    setValue("");
  }

  // Arrow keys never move the caret or scroll the page here — each press
  // is captured and appended as its own glyph character instead, so a
  // sequence like "UP UP DOWN DOWN..." becomes literal, orderable text the
  // server can tokenize (see lib/cheat-codes.ts tokenize()). Appending
  // always happens at the end of the string rather than at the caret,
  // trading mid-string editing of arrows for a much simpler, Konami-code-
  // style entry box.
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const glyph = ARROW_KEY_GLYPH[e.key];
    if (glyph) {
      e.preventDefault();
      setValue((v) => v + glyph);
    } else if (e.key === "Enter") {
      submit();
    }
  }

  async function submit() {
    const raw = value;
    if (!raw.trim()) return;
    try {
      const result = await apiFetch<AttemptResponse>("/api/cheat/attempt", { method: "POST", body: JSON.stringify({ raw }) });
      if (result.result === "fail") {
        setValue("");
        setModal({ kind: "fail" });
        setTimeout(() => setModal((m) => (m.kind === "fail" ? { kind: "entering" } : m)), 1500);
        return;
      }
      if (result.noDisplay) {
        // MONOLOGUE — already applied server-side, nothing to show.
        setValue("");
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        setModal({ kind: "closed" });
        return;
      }
      setValue("");
      setModal({ kind: "success", codeKey: result.codeKey!, description: result.description ?? "", secondsLeft: CHEAT_EXECUTE_DELAY_SECONDS });
    } catch (err) {
      // A real request failure (network drop, 401, 500, ...) — never
      // presented the same as "wrong code," which would otherwise make a
      // broken deployment look identical to a bad guess.
      setValue("");
      setModal({ kind: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        aria-label="???"
        title=" "
        className="fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full border-2 border-neutral-700 bg-neutral-900/60 text-neutral-500 opacity-30 shadow-lg transition-opacity duration-150 hover:opacity-90"
      >
        <EggIcon />
      </button>

      {modal.kind !== "closed" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
          <div className="relative w-full max-w-sm space-y-4 rounded-lg border-2 border-neutral-700 bg-neutral-900 p-6 text-white shadow-2xl">
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-800 hover:text-white"
            >
              <CloseIcon />
            </button>

            {modal.kind === "entering" && (
              <>
                <p className="pr-6 text-sm font-semibold uppercase tracking-wide text-neutral-400">Enter Cheat Code:</p>
                <input
                  ref={inputRef}
                  autoFocus
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 font-mono text-lg tracking-wider text-white outline-none focus:border-accent-500"
                  placeholder=""
                  spellCheck={false}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={submit}
                  className="w-full rounded-full bg-accent-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-accent-600"
                >
                  Submit
                </button>
              </>
            )}

            {modal.kind === "fail" && (
              <div className="py-6 text-center">
                <p className="text-2xl font-bold text-accent-400">Try Again</p>
              </div>
            )}

            {modal.kind === "error" && (
              <div className="space-y-2 py-6 text-center">
                <p className="text-lg font-bold text-accent-400">Something went wrong</p>
                <p className="text-sm text-neutral-300">{modal.message}</p>
              </div>
            )}

            {modal.kind === "success" && (
              <div className="space-y-4 text-center">
                <p className="text-lg font-bold text-accent-2-400">Success</p>
                <p className="text-sm leading-relaxed text-neutral-200">{modal.description}</p>
                <p className="text-4xl font-extrabold tabular-nums text-white">{modal.secondsLeft}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {data?.actor?.role === "instructor" && data.activeGlobalAnnouncement && (
        // Keyed by announcement id so a new announcement remounts this
        // component fresh (resetting its own "still visible" state) instead
        // of needing an effect to detect the prop change — see the
        // component below for why that matters under this project's strict
        // react-compiler lint rules.
        <GlobalAnnouncementToast key={data.activeGlobalAnnouncement.id} announcement={data.activeGlobalAnnouncement} />
      )}

      {monologue && <MonologueOverlay monologue={monologue} />}
    </>
  );
}

// Auto-dismisses after autoDismissSeconds by starting a timer on mount and
// flipping state inside the timer's callback — not synchronously in the
// effect body — which is the one place this lint config allows a setState
// call originating from an effect. Relies on the `key={id}` at the call site
// above to reset `visible` for a new announcement, rather than tracking
// "which id is this" as state itself.
function GlobalAnnouncementToast({ announcement }: { announcement: { title: string; message: string; autoDismissSeconds: number | null } }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeoutId = setTimeout(() => setVisible(false), (announcement.autoDismissSeconds ?? 10) * 1000);
    return () => clearTimeout(timeoutId);
  }, [announcement.autoDismissSeconds]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 right-5 z-50 w-full max-w-sm rounded-lg border-2 border-accent bg-accent-900 p-4 shadow-2xl">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent-300">{announcement.title}</p>
      <p className="mt-1 text-sm font-medium text-white">{announcement.message}</p>
    </div>
  );
}

// Cheat code #6's game-wide pause: one line at a time, 5s each, on top of
// every screen in the session (see lib/cheat-engine.ts resolveCheatMonologue
// for how the pause itself resumes automatically once this finishes).
function MonologueOverlay({ monologue }: { monologue: { index: number; total: number; text: string } }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black px-10">
      <p key={monologue.index} className="max-w-3xl animate-fade-in-slow text-center text-xl font-medium leading-relaxed text-white sm:text-2xl">
        {monologue.text}
      </p>
    </div>
  );
}

function EggIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 22c4.418 0 8-3.5 8-8.5C20 8 16 2 12 2S4 8 4 13.5C4 18.5 7.582 22 12 22Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="4" y1="4" x2="20" y2="20" />
      <line x1="20" y1="4" x2="4" y2="20" />
    </svg>
  );
}
