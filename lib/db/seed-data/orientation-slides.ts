// Container for the orientation/pre-session slide content (see
// components/slide-deck.tsx). This is content work, not engineering — every
// slide below is clearly-marked placeholder copy. Do not treat this as
// final pedagogical text; that's Tim's to write.
export interface OrientationSlide {
  id: string;
  audience: "projector" | "instructor";
  title: string;
  bodyMarkdown: string;
}

export const orientationSlides: OrientationSlide[] = [
  {
    id: "proj-1",
    audience: "projector",
    title: "[PLACEHOLDER] What This Simulation Is",
    bodyMarkdown:
      "Six teams each run a WHO regional office responding to a live pandemic scenario. Every decision you make is scored and feeds a shared epidemic model everyone in the room can see change.",
  },
  {
    id: "proj-2",
    audience: "projector",
    title: "[PLACEHOLDER] How Decisions Are Scored",
    bodyMarkdown:
      "Every decision is scored 40% evidence-based practice, 30% political/economic realism, 30% equity. There is no single \"correct\" answer — the rubric exists because real global-health decisions are genuinely multi-objective, and trading one dimension against another is the point.",
  },
  {
    id: "proj-3",
    audience: "projector",
    title: "[PLACEHOLDER] Regions Are Asymmetric on Purpose",
    bodyMarkdown:
      "Your region's starting resources, surveillance capacity, and political standing differ from every other region's. That's deliberate — coordination between regions is part of the pedagogy, not a workaround for unequal starting conditions.",
  },
  {
    id: "proj-4",
    audience: "projector",
    title: "[PLACEHOLDER] The Shadow Simulation",
    bodyMarkdown:
      "A parallel \"what if every decision had been Optimal\" simulation runs alongside the real one for the whole session. The debrief compares your actual outcome against that counterfactual — not against a fixed answer key.",
  },
  {
    id: "instr-1",
    audience: "instructor",
    title: "[PLACEHOLDER] Pre-Session Checklist",
    bodyMarkdown:
      "- Create your session and print/share the credential sheet with each team.\n- Confirm every team can log in before you start.\n- Open the projector display on the room screen (no login required).\n- Decide your pacing: the tempo dial lets you speed up or slow down mid-session.",
  },
  {
    id: "instr-2",
    audience: "instructor",
    title: "[PLACEHOLDER] Running the Session",
    bodyMarkdown:
      "Dispatch events from the Command Center as the session progresses. Score submissions from the Scoring Inbox — the one-click \"Accept Suggested\" fast path handles routine, non-mandatory-review decisions. Use the tempo dial to adjust pacing live if the room is running fast or slow.",
  },
  {
    id: "instr-3",
    audience: "instructor",
    title: "[PLACEHOLDER] Running the Debrief",
    bodyMarkdown:
      "The debrief page shows each team's actual-vs-Optimal comparison, their tier distribution across the session, and the round-by-round summary. Use it to walk through a few specific decisions rather than just the aggregate numbers — the trade-offs are more memorable than the score.",
  },
];

export function slidesFor(audience: "projector" | "instructor"): OrientationSlide[] {
  return orientationSlides.filter((s) => s.audience === audience);
}
