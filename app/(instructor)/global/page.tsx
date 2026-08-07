import { ownedActiveSession } from "@/lib/session-context";
import { OpenDisplayButton } from "@/components/open-display-button";

// The projector display, embedded in the console so a facilitator can watch
// what the room is seeing without switching windows — and pop it out to the
// projector when they want it on the big screen.
//
// This embeds the real /display/[token] route in an iframe rather than
// re-implementing it: the display already owns its own polling, announcement
// handling, and end-of-game summary states (see app/display/[token]/page.tsx),
// and a second copy of that logic would drift out of sync with the projector
// the room is actually looking at. The iframe is same-origin, so it polls
// /api/display exactly as the projector does.
export default async function GlobalViewPage() {
  const active = await ownedActiveSession();

  if (!active) {
    return (
      <p className="text-sm text-slate-400">
        No active session. Start one from <a href="/sessions" className="text-blue-400 hover:text-blue-300">your sessions</a> to
        get a projector display.
      </p>
    );
  }

  const displayPath = `/display/${active.displayToken}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Global View</h2>
          <p className="text-sm text-slate-400">
            What the room sees. No login required — anyone with the link can display it.
          </p>
        </div>
        <OpenDisplayButton displayToken={active.displayToken} />
      </div>

      <div className="rounded-md border border-slate-800 bg-slate-900 overflow-hidden">
        <iframe
          src={displayPath}
          title="Projector display"
          className="w-full aspect-video block"
        />
      </div>

      <p className="text-xs text-slate-500 break-all">
        Direct link: <code className="text-slate-400">{displayPath}</code>
      </p>
    </div>
  );
}
