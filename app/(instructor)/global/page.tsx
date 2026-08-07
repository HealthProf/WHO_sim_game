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
      <p className="text-sm text-neutral-600">
        No active session. Start one from <a href="/sessions" className="font-medium text-accent-700 hover:text-accent-600">your sessions</a> to
        get a projector display.
      </p>
    );
  }

  const displayPath = `/display/${active.displayToken}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-[32px] text-text">Global View</h1>
          <p className="text-sm text-neutral-700">
            What the room sees. No login required — anyone with the link can display it.
          </p>
        </div>
        <OpenDisplayButton displayToken={active.displayToken} className="shrink-0 rounded-full border-2 border-divider px-3 py-1 text-sm text-text hover:bg-surface" />
      </div>

      <div className="overflow-hidden rounded-lg bg-neutral-900">
        <iframe
          src={displayPath}
          title="Projector display"
          className="block aspect-video w-full"
        />
      </div>

      <p className="break-all text-xs text-neutral-600">
        Direct link: <code className="text-neutral-700">{displayPath}</code>
      </p>
    </div>
  );
}
