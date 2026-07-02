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
            simulated day. Clicking Dispatch opens a region picker — most events default to all six selected, but a
            few (marked <b className="text-purple-300">Targeted</b>, e.g. the SEARO data-sharing standoff) default to
            the specific subset named in the original design; you can always adjust the selection before confirming.
            Anchor events (marked in each event&apos;s trigger note) are meant to fire on a fixed schedule; adaptive
            events are meant to fire when their trigger condition is met — read the trigger note and use your
            judgment on timing. An event greyed out with &quot;Blocked by...&quot; means a prerequisite event
            hasn&apos;t been fully resolved yet (chain integrity — this is enforced automatically).
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
        <h2 className="text-lg font-semibold text-slate-100">Deadlines, Targeted Events &amp; Popups</h2>
        <ul className="list-disc list-inside space-y-2">
          <li><b className="text-slate-100">Active Deadlines panel</b> — the Command Center and the public display both show every currently-open countdown at once (not just whichever event you happen to be looking at), so you can track several concurrent timers across different events.</li>
          <li><b className="text-slate-100">Targeted events</b> — EVT-002 (SEARO/WPRO/EURO) and the two adaptive events (EVT-009, EVT-013) are designed to go to a subset of regions, not everyone. Once every targeted region&apos;s decision is scored, the whole room automatically learns the outcome: a 10-second popup on the projector, and a popup on every team&apos;s dashboard that has to be closed with a button (not just a 10-second flash — a missed toast is easy to lose during a live session).</li>
          <li><b className="text-slate-100">&quot;New event&quot; popups</b> — every dispatch also triggers a 10-second projector popup and a must-close popup on every targeted team&apos;s dashboard, so teams don&apos;t have to be staring at the Events page to notice something arrived.</li>
        </ul>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">Glossary &amp; Advisory Board</h2>
        <p>
          Teams get a full Glossary page (plain-language definitions of every acronym and technical term — PHEIC,
          IHR Article 12, Rt, CFR, COVAX, etc.), plus a small &quot;Key Terms&quot; box automatically shown on each
          event page with just the terms relevant to that decision. Every decision event also shows an{" "}
          <b className="text-slate-100">Advisory Board</b> — 3-4 diverse, sometimes-contradictory stakeholder
          opinions (an epidemiologist, a host-government liaison, a donor-state diplomat, etc.). These are
          deliberately not a hint toward the &quot;correct&quot; answer — some openly argue for options that would
          score poorly, the way real advisors actually do.
        </p>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">Confidence Wager &amp; Resource Pledges</h2>
        <ul className="list-disc list-inside space-y-2">
          <li><b className="text-slate-100">Confidence wager</b> — teams tag Low/Medium/High confidence alongside every decision. It&apos;s not scored on whether they were confident, only on calibration: High confidence paired with a good outcome earns a small bonus, High confidence paired with a bad outcome takes a bigger penalty, and Low confidence is never penalized either way. You&apos;ll see the raw score, the adjustment, and the final tier side by side on the scoring screen.</li>
          <li><b className="text-slate-100">Resource pledges</b> — teams can pledge PPE, funds, antivirals, or HCW surge capacity directly to another region from the Pledges page. Unlike a rationale line, this actually moves the numbers between regions&apos; live ledgers, and shows up as a first-class artifact on the Debrief page.</li>
        </ul>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">Option Costs &amp; Affordability</h2>
        <p>
          Every structured decision option now lists a concrete cost (fund/PPE-days/antivirals, where relevant) and
          a plain-language description of what it actually does to that region&apos;s dashboard. Cost is deducted the
          moment a team submits, not when you score it — if they resubmit before you&apos;ve scored, the prior charge
          is automatically refunded first so switching their answer never double-charges them. A team physically
          can&apos;t select an option they can&apos;t currently afford; the option is grayed out with a plain-language
          reason (e.g. &quot;needs $3.0M, you have $1.2M&quot;).
        </p>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">Budget Cycle (every 14 narrative days)</h2>
        <p>
          A new pending cycle appears automatically on the Control page every 14 narrative days on the game clock.
          You get three options:
        </p>
        <ul className="list-disc list-inside space-y-2">
          <li><b className="text-slate-100">Push Default to All</b> — silently disburses each region&apos;s standard increase (12% of its starting fund).</li>
          <li><b className="text-slate-100">Adjust Amounts</b> — set a custom amount per region yourself, no team input.</li>
          <li><b className="text-slate-100">Snap Decision</b> — every region gets a short window to accept the default or request more. If anyone requests more, a second window opens asking every <i>other</i> region whether they want to donate part of their own disbursement to the requester(s); donations are pooled and split proportionally across however many regions asked.</li>
        </ul>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">Marketplace (PPE &amp; Antivirals)</h2>
        <p>
          Regions can buy PPE-days or antivirals from WHO HQ&apos;s stockpile at an adaptive price (rises as WHO HQ&apos;s
          own stock depletes and as the global escalation state worsens), or trade directly with another region
          (accept/reject only — no counter-offers). WHO HQ purchases land in your approval queue on the Control
          page — other regions get a heads-up notification for ~30 seconds before you&apos;d typically process a
          batch, so more than one region can get in on the same round. Approving re-validates that WHO HQ still has
          the stock and the region still has the funds (either can have moved since the request was submitted).
          Every approved sale is announced to the whole room, not just the buyer.
        </p>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">Emergency Funding</h2>
        <p>
          A region can broadcast an emergency funding request to every other region and to WHO HQ. WHO HQ carries
          its own budget, larger than any single region&apos;s and <i>not</i> topped up by the regular budget cycle —
          spending it down is a real, permanent tradeoff for you as the instructor. Each region and WHO HQ can
          independently contribute some, all, or none of what&apos;s asked; there&apos;s no hard timer, so you decide
          when to close a request and disburse whatever&apos;s been pledged from the Control page.
        </p>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">Redesigned Public Display</h2>
        <p>
          The projector display is now two columns instead of a map-plus-ticker: the left side shows live stat
          tiles and per-region bar charts for confirmed cases, deaths, and Rt (each bar is directly labeled with
          region code and value, not color alone); the right side is a live event feed with the newest item on top,
          briefly highlighted when it first arrives. Older items scroll rather than disappearing.
        </p>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">Debrief: Actual vs. Ideal Playthrough</h2>
        <p>
          Alongside the real trajectory, a parallel &quot;shadow&quot; simulation runs the entire session in lockstep,
          applying only the best-tier (OPTIMAL) consequence at every decision point. The Debrief page&apos;s opening
          section compares the two directly — actual vs. ideal confirmed cases and deaths, world totals and
          per-region — framed as infections and deaths that a stronger playthrough could realistically have
          prevented. The same comparison also appears on the team Summary page and the projector&apos;s end-of-game
          screen.
        </p>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">Population Trust &amp; Happiness</h2>
        <p>
          Each region now tracks two social metrics on its dashboard: public trust (unchanged field, now surfaced
          more prominently) and a new population happiness index. Both drift down passively based on the global
          escalation state and on fresh deaths, and both move directly in response to event-choice consequences —
          harsh containment measures tend to cost happiness even when they help the epidemiology, and transparency
          tends to help trust even when it&apos;s costly. World averages for both appear on every team&apos;s dashboard
          header and on the public display.
        </p>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">Epidemic Growth Model (Recalibrated)</h2>
        <p>
          Confirmed cases and deaths now grow using an actual epidemiological growth identity tied to each
          region&apos;s live Rt (roughly a 5-day serial interval — Rt above 3 doubles case counts every 2-3 narrative
          days), instead of the earlier flat rate that barely responded to Rt at all. Growth is logistic, not
          unbounded: it tapers as confirmed cases approach a per-region ceiling scaled by real population and that
          region&apos;s current surveillance capacity, so a weak-surveillance region always undercounts relative to a
          well-instrumented one at the same true infection level. An Rt held below 1 lets new-case growth taper
          toward zero — a region can now actually plateau, not just slow down.
        </p>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">Live Dispatch Target Hints</h2>
        <p>
          Adaptive events whose trigger condition names a region that can only be known from current game state
          (e.g. &quot;any region whose political tension exceeds 70&quot;) now show an amber &quot;Currently qualifies&quot; badge
          in the Event Queue, computed live and pre-filled into the region picker when you hit Dispatch — you no
          longer have to eyeball each region&apos;s live numbers yourself to figure out who actually triggered it.
        </p>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">Post-Scoring Reveal</h2>
        <p>
          Every scored decision — not just the dramatic ones — now posts a plain &quot;REGION chose OPTION, scored
          TIER&quot; line to every other region&apos;s dashboard (Recent Developments), regardless of event scope. This is
          separate from the existing restricted-event &quot;Final Decision&quot; popup (which still fires as a bigger
          moment once a whole restricted group like EVT-002 finishes deciding) — the new mechanic is the lightweight,
          always-on version, so a targeted region&apos;s choice actually lands on everyone once it&apos;s judged, not just
          the instructor and the deciding team.
        </p>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">Social-Metric Consequence Arcs</h2>
        <p>
          Public trust, population happiness, and political tension now carry real stakes. Each has a 3-stage
          bad-direction arc — Warning, Escalation, Crisis — that fires as a real dispatched event (EVT-017 through
          EVT-025) once a region crosses that stage&apos;s threshold, with its own decision prompt, costed options, and
          consequences (up to real Rt/CFR/HCW-capacity damage at the Crisis stage). Use the live target hint on each
          to see who currently qualifies. A region whose political tension ruptures past 90 (EVT-025) is
          mechanically locked out of the WHO HQ marketplace and emergency funding until it comes back down, not just
          narratively — the API actually rejects those requests.
        </p>
        <p>
          The good-direction mirror is automatic, not a dispatched event: sustained high trust/happiness or
          sustained low political tension (both per-region and world-average) triggers a one-time reward — a fund
          bonus, an Rt/HCW/surveillance boost, or for the world-level versions, a WHO HQ fund or stockpile top-up —
          the moment the threshold is crossed, with a plain notification explaining why. Each milestone can only
          fire once per region (or once globally) for the whole session.
        </p>
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
