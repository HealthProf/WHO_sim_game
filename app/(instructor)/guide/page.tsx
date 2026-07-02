import Link from "next/link";

export default function GuidePage() {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Facilitator Guide</p>
        <h1 className="text-2xl font-semibold">Running Operation Veiled Horizon</h1>
      </div>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">The Session Loop, Step by Step</h2>
        <ol className="list-decimal list-inside space-y-2">
          <li>
            <b className="text-slate-100">Start the simulation</b> from the Command Center. This starts the
            in-game/real-time clock shown in the header on every screen (in-game time and real elapsed time move
            together, at a compressed pace — a stated &quot;2-hour deadline&quot; becomes a couple of real minutes).
          </li>
          <li>
            <b className="text-slate-100">Dispatch events</b> from the Command Center&apos;s Event Queue, grouped by
            simulated day. Anchor events (marked in each event&apos;s trigger note) are meant to fire on a fixed
            schedule; adaptive events are meant to fire when their trigger condition is met — read the trigger note
            and use your judgment on timing. An event greyed out with &quot;Blocked by...&quot; means a prerequisite
            event hasn&apos;t been fully resolved yet (chain integrity — this is enforced automatically).
          </li>
          <li>
            <b className="text-slate-100">Teams respond</b> on their own screens — you don&apos;t need to do
            anything while they&apos;re working, other than watch the Command Center&apos;s &quot;Needs Your
            Attention&quot; panel fill up.
          </li>
          <li>
            <b className="text-slate-100">Score submissions</b> in the Scoring Inbox. It&apos;s sorted so the most
            urgent items are at the top: anything flagged <b className="text-red-400">MANDATORY REVIEW</b> always
            comes first and can&apos;t be fast-pathed. For everything else, a suggested tier is pre-computed from the
            team&apos;s structured choice — click <b>Accept Suggested</b> on a single one, or <b>Accept all
            suggested</b> to clear a whole batch of straightforward submissions in one click. Only open the full
            per-dimension scoring screen when you actually want to read the rationale closely or override the
            suggestion.
          </li>
          <li>
            <b className="text-slate-100">Watch the model update</b> — scoring a submission immediately applies
            its consequence to that region&apos;s live state (Rt, CFR multiplier, resources, etc.), which every
            team&apos;s dashboard reflects within about 15 seconds.
          </li>
          <li>
            <b className="text-slate-100">Push select events to the projector</b> — dispatching an event to teams
            never automatically shows it on the public display. On any dispatched event card, click{" "}
            <b>Push to Global Display</b> when you want that beat to appear on the shared screen and ticker. This is
            a deliberate, separate action so you control the classroom narrative pacing.
          </li>
          <li>
            <b className="text-slate-100">Pause any time</b> — pausing freezes the clock (both in-game and real
            elapsed time stop advancing) without closing any open submission windows. Resume picks up exactly where
            you left off.
          </li>
          <li>
            <b className="text-slate-100">Close out</b> with Mark Complete when you&apos;re done — this is a soft,
            reversible state (Reopen is always available if you need more time), and the Debrief page compiles the
            after-action artifacts (Rt trajectory, the EVT-006 vs EVT-012 vaccine allocation comparison, and the
            most consequential decisions of the session).
          </li>
        </ol>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">Other Controls Worth Knowing About</h2>
        <ul className="list-disc list-inside space-y-2">
          <li><b className="text-slate-100">Model Override</b> — directly edit any region&apos;s live numbers if you need to correct something or nudge the scenario; every override requires a short reason and is logged.</li>
          <li><b className="text-slate-100">Action Log</b> — a full audit trail of every dispatch, score, override, and status change you&apos;ve made, with timestamps.</li>
          <li><b className="text-slate-100">Deadlines enforce themselves</b> — HARD/SOFT deadlines auto-apply their fallback consequence tier when time runs out, even if you&apos;re not looking at the screen at that moment.</li>
          <li><b className="text-slate-100">Passive drift</b> — regional Rt creeps upward slowly on its own whenever the sim is running and no fresh containment decision has landed for a while, so idle time between events isn&apos;t free.</li>
        </ul>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">Making Consequences Visible</h2>
        <ul className="list-disc list-inside space-y-2">
          <li><b className="text-slate-100">Auto-push for big swings</b> — you no longer have to remember to click &quot;Push to Global Display&quot; for the dramatic moments. Any mandatory-review event, any Critical Failure, or any decision producing a large model swing pushes itself to the projector and drops a callout on the affected team&apos;s dashboard automatically.</li>
          <li><b className="text-slate-100">Every scored decision gets a private card</b> — teams see a specific &quot;here&apos;s what just happened because of your choice&quot; notification on their dashboard (Recent Developments), not just numbers moving with no explanation.</li>
          <li><b className="text-slate-100">Core path vs. optional events</b> — the Event Queue has a filter for the recommended ~60-minute spine (13 of the 16 events; the 3 marked Optional — MSF Open Letter, NPI Compliance Collapse, Political Interference — can be skipped without blocking anything downstream). Use it if you&apos;re running behind.</li>
          <li><b className="text-slate-100">Per-team response checklist</b> — dispatched global/multi-region events show a chip per region so you can call out exactly who hasn&apos;t responded while circulating the room, instead of just a count.</li>
        </ul>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">Emergency Committee Snap Vote</h2>
        <p>
          A break-glass pacing tool on the Command Center, separate from the scripted 16 events — call it any time to
          force a synchronous, timed (default 90s) all-team response to a single yes/no (or custom) question. Useful
          if a session is dragging, or you want to test coordination under acute pressure. Closing a vote applies a
          small automatic model effect: near-unanimous agreement eases global media pressure, a split vote raises it,
          and any region that didn&apos;t participate takes a small political-tension hit. Teams only see response
          <i>counts</i> while a vote is open, never the breakdown, so they can&apos;t herd-vote off each other.
        </p>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">Confidence Wager &amp; Resource Pledges</h2>
        <ul className="list-disc list-inside space-y-2">
          <li><b className="text-slate-100">Confidence wager</b> — teams tag Low/Medium/High confidence alongside every decision. It&apos;s not scored on whether they were confident, only on calibration: High confidence paired with a good outcome earns a small bonus, High confidence paired with a bad outcome takes a bigger penalty, and Low confidence is never penalized either way. You&apos;ll see the raw score, the adjustment, and the final tier side by side on the scoring screen.</li>
          <li><b className="text-slate-100">Resource pledges</b> — teams can pledge PPE, funds, antivirals, or HCW surge capacity directly to another region from the Pledges page. Unlike a rationale line, this actually moves the numbers between regions&apos; live ledgers, and shows up as a first-class artifact on the Debrief page.</li>
        </ul>
      </section>

      <Link
        href="/control"
        className="inline-block rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-5 py-2.5"
      >
        Go to Command Center
      </Link>
    </div>
  );
}
