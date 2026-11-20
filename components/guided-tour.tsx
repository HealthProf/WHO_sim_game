"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// Guided walkthrough for teams (Release 4 playtest request): a step-by-step
// spotlight tour of the screen. It starts automatically the first time a
// region opens the app in a browser (remembered in localStorage; if storage
// is unavailable it simply starts each visit), and can be replayed from the
// rail's "Take the tour" button (dispatches the "who-tour:start" event).
//
// Each step points at an element marked data-tour="..."; if that element
// isn't visible (e.g. the rail is collapsed on a phone), the step is shown
// as a centered card instead, so the tour works everywhere. Sits below the
// Scenario Overview deck (z-100) and above announcement modals (z-50).

interface Step {
  target?: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: "Welcome to your regional office",
    body: "You're running one of WHO's six regional offices through an outbreak. Events arrive over the game; you make decisions, the world reacts. This 1-minute tour shows where everything is.",
  },
  {
    target: "ledger",
    title: "Your ledger",
    body: "Your money, PPE, antivirals and health-worker capacity, plus Rt (above 1 means the outbreak is growing). Trust and tension run 0-100 with named bands: trust under 45 triggers warning events, under 15 is a crisis, 80+ earns a bonus. For tension it's reversed: at 90 you lose access to WHO HQ purchases. Check it before choosing an option that costs money.",
  },
  {
    target: "nav-events",
    title: "Events: your decisions",
    body: "Each event is a decision. Blue means to do, amber means submitted and waiting for a grade, gray with a check means scored. Open one to see a short summary, what each choice is expected to do, and advisor views. Write 2-5 sentences covering the evidence, what's realistic, and who is most affected.",
  },
  {
    target: "deadline",
    title: "Deadlines",
    body: "Events have a timer. If you miss it, a default (usually poor) consequence applies. You can resubmit before the deadline; only your latest submission counts.",
  },
  {
    target: "nav-pledges",
    title: "Pledges & Funding",
    body: "Give resources to another region, or ask everyone (including WHO HQ) for emergency money. This opens after the first few events, so you can learn the event loop first. You can cancel a request until someone acts on it.",
  },
  {
    target: "nav-marketplace",
    title: "Marketplace",
    body: "Buy PPE or antivirals from WHO HQ, or trade with another region. Prices rise as stock runs out. Opens a little later in the game.",
  },
  {
    target: "nav-coordination",
    title: "Coordination",
    body: "Message other regions to negotiate. Some events go better when regions coordinate first.",
  },
  {
    target: "nav-dashboard",
    title: "Situation and the world view",
    body: "The Situation page has your region's details and a World tab: a map with each region's mascot (its face shows how things are going) and charts of how Rt, cases, deaths, trust and morale have changed over time.",
  },
  {
    title: "Unfamiliar terms",
    body: "Words with a dotted underline in event text have a definition: tap or hover them. That's it. You can replay this tour anytime from the menu.",
  },
];

const PAD = 8;

function visibleTarget(name?: string): HTMLElement | null {
  if (!name) return null;
  const els = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`));
  return els.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }) ?? null;
}

export function GuidedTour({ storageKey }: { storageKey: string }) {
  const [step, setStep] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(storageKey, "done");
    } catch {
      // Storage unavailable (private mode): the tour just isn't remembered.
    }
    setStep(null);
  }, [storageKey]);

  useEffect(() => {
    let seen = false;
    try {
      seen = localStorage.getItem(storageKey) === "done";
    } catch {
      seen = false;
    }
    const t = seen ? null : setTimeout(() => setStep(0), 1200);
    const start = () => setStep(0);
    window.addEventListener("who-tour:start", start);
    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener("who-tour:start", start);
    };
  }, [storageKey]);

  const measure = useCallback(() => {
    if (step == null) return;
    const el = visibleTarget(STEPS[step].target);
    if (el) el.scrollIntoView({ block: "nearest" });
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  useLayoutEffect(() => {
    if (step == null) return;
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    nextRef.current?.focus();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, measure]);

  useEffect(() => {
    if (step == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") setStep((s) => (s != null && s < STEPS.length - 1 ? s + 1 : s));
      if (e.key === "ArrowLeft") setStep((s) => (s != null && s > 0 ? s - 1 : s));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, finish]);

  if (step == null) return null;
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  // Card placement: beside the target when there's room, else below/above,
  // else centered.
  let cardStyle: React.CSSProperties = { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  if (rect) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right + 340 < vw) cardStyle = { left: rect.right + PAD * 2, top: Math.min(Math.max(12, rect.top), vh - 280) };
    else if (rect.bottom + 260 < vh) cardStyle = { left: Math.min(Math.max(12, rect.left), vw - 332), top: rect.bottom + PAD * 2 };
    else cardStyle = { left: Math.min(Math.max(12, rect.left), vw - 332), top: Math.max(12, rect.top - 260) };
  }

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-lg ring-2 ring-white motion-safe:transition-all motion-safe:duration-300"
          style={{
            left: rect.left - PAD,
            top: rect.top - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(20, 18, 16, 0.65)",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-[rgba(20,18,16,0.65)]" />
      )}
      <div className="fixed w-[min(320px,calc(100vw-24px))] rounded-lg bg-bg p-4 text-text shadow-lg" style={cardStyle}>
        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-700">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 id="tour-title" className="mt-0.5 font-heading text-[20px] leading-tight">
          {s.title}
        </h2>
        <p id="tour-body" className="mt-2 text-sm leading-snug text-neutral-800">
          {s.body}
        </p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" onClick={finish} className="text-sm text-neutral-700 underline hover:text-text">
            Skip tour
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="rounded-full border-2 border-divider px-4 py-1.5 text-sm font-semibold">
                Back
              </button>
            )}
            <button
              ref={nextRef}
              type="button"
              onClick={() => (last ? finish() : setStep(step + 1))}
              className="rounded-full bg-accent-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-accent-600"
            >
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StartTourButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("who-tour:start"))}
      className="text-sm text-neutral-400 underline hover:text-white"
    >
      Take the tour
    </button>
  );
}
