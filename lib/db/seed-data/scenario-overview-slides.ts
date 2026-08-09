// Update 3's Scenario Overview opening sequence — the synchronized,
// full-screen, white-on-black slide deck shown on every connected screen
// (region dashboards, instructor console, projector display) at the start
// of a new session and after every reset. See components/scenario-overview-
// overlay.tsx for the rendering and lib/use-scenario-overview.ts for how
// clients derive the current slide from the server's broadcast timestamp.
//
// Deliberately data-driven — nothing downstream hardcodes the slide count or
// total duration; both fall out of this array. Content below is copied
// verbatim from the author-approved copy; do not edit the wording without
// the author's sign-off.

// Default duration for a slide that doesn't set its own `seconds` field.
export const SCENARIO_SLIDE_SECONDS = 10;

export interface ScenarioSlide {
  id: string;
  body: string;
  // Overrides SCENARIO_SLIDE_SECONDS for this one slide — e.g. the closing
  // "Let's begin." doesn't need a full 10s. Most slides omit this.
  seconds?: number;
}

export const SCENARIO_OVERVIEW_SLIDES: ScenarioSlide[] = [
  {
    id: "scenario-1",
    body: "Welcome to Operation Veiled Horizon. You will serve as the leader of a World Health Organization regional office, responding to events as they unfold. Your task: help guide the world through an emerging pandemic.",
  },
  {
    id: "scenario-2",
    body: "A new pandemic is beginning. Its final scale is unknown — how far it will spread, how many will be affected, and who it will affect most. Its origin is also unclear.",
  },
  {
    id: "scenario-3",
    body: "These uncertainties are yours to face. Over the course of this simulation, you will respond to this emerging crisis with the tools and authority available to your position.",
  },
  {
    id: "scenario-4",
    body: "As a regional director, you do not command the nations of the world. But you work alongside them — coordinating aid, sharing critical information, and shaping the global response.",
  },
  {
    id: "scenario-5",
    body: "What you choose to do in this simulation will shape how it unfolds. The number of people infected, and the number who die, depends on the decisions made in this room.",
  },
  {
    id: "scenario-6",
    body: "You will now enter the briefing for your region. Read it carefully — it contains the insight you will need to respond well.",
  },
  {
    id: "scenario-7",
    body: "Let's begin.",
    seconds: 5,
  },
];

// Cumulative offset (in seconds) each slide begins at — precomputed once so
// lib/use-scenario-overview.ts's per-tick lookup doesn't recompute it on
// every render. SCENARIO_OVERVIEW_TOTAL_SECONDS is the sum of every slide's
// duration, not a uniform multiplication, since durations aren't uniform.
export const SCENARIO_OVERVIEW_SLIDE_STARTS: number[] = (() => {
  let offset = 0;
  return SCENARIO_OVERVIEW_SLIDES.map((slide) => {
    const start = offset;
    offset += slide.seconds ?? SCENARIO_SLIDE_SECONDS;
    return start;
  });
})();

export const SCENARIO_OVERVIEW_TOTAL_SECONDS = SCENARIO_OVERVIEW_SLIDES.reduce(
  (sum, slide) => sum + (slide.seconds ?? SCENARIO_SLIDE_SECONDS),
  0
);
