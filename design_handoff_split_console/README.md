# Handoff: Split Console — front-end redesign for Operation Veiled Horizon

## Overview

A visual and structural redesign of the team-facing front end of the WHO pandemic
simulation (`HealthProf/WHO_sim_game`). The current UI is a blue-slate Tailwind
dashboard where every page is a flat stack of cards and the team's own resource
ledger is only visible on `/dashboard` — so a team reading an event, proposing a
trade, or answering a funding appeal cannot see whether they can afford what
they are about to do.

**Split Console** fixes that structurally: a persistent left rail holds the
team's identity, live ledger, in-game clock, the single most urgent deadline,
and primary navigation. It never unmounts. The right column swaps between the
existing ten team pages. Visually it moves from blue-slate onto the **Organic**
design system — a warm cream ground (`#f5ead8`), terracotta accent, sage second
accent, Caprasimo display headings over Figtree body.

Nothing in the repo has been changed. This bundle is the spec for doing that.

## About the design files

The files in this bundle are **design references created in HTML** — prototypes
showing intended look and structure, not production code to copy. The task is to
**recreate them inside the existing Next.js App Router + Tailwind codebase**,
using its established patterns (server components in the route-group layout,
`useQuery` polling in client components, `apiFetch`). Do not paste this HTML
into the app; do not introduce a second styling approach alongside Tailwind.

Every API route, query key, poll interval, and data shape stays exactly as it is.
This is a presentation-layer change only. `lib/`, `app/api/`, and the Drizzle
schema should not need to be touched.

## Fidelity

**High-fidelity.** Colors, type, radii, and spacing below are final and exact.
Layout proportions (rail width, column gaps, card padding) are final. Copy shown
in the mock is illustrative except where this document marks it as literal.

## Design tokens

Add these to `app/globals.css` as CSS custom properties and expose them to
Tailwind via `@theme inline` (the file already uses that pattern for
`--color-background` / `--color-foreground`). Replace the existing `:root` /
`prefers-color-scheme` block — the app should not follow OS dark mode; the rail
is dark and the content column is light by design, always.

### Color

| Token | Hex | Used for |
| --- | --- | --- |
| `--color-bg` | `#f5ead8` | content column ground |
| `--color-surface` | `#ebddc5` | secondary cards inside the content column |
| `--color-text` | `#201e1d` | body and heading text on the light ground |
| `--color-accent` | `#c67139` | large display numerals, bars, borders, focus rings — **not** a fill behind white text |
| `--color-accent-700` | `#8c491a` | primary button fill, chips, active nav pill (white on it = 6.81:1) |
| `--color-accent-2` | `#7a8a5e` | second voice — projection card, own-region row |
| `--color-divider` | `color-mix(in srgb, #201e1d 16%, transparent)` | table rules, option borders |

Tonal ramps (100 → 900), all on one shared OKLCH lightness scale:

- **neutral** `#f9f4ed` `#eee7db` `#dcd3c4` `#c0b6a5` `#a19786` `#82796a` `#645c50` `#474238` `#2e2b25`
- **accent** `#fff2eb` `#ffe1d0` `#ffc6a5` `#f6a06b` `#d67f48` `#b2622d` `#8c491a` `#643312` `#402310`
- **accent-2** `#f0fae1` `#e1eecc` `#ccdbb2` `#aebf92` `#8fa073` `#728157` `#56633f` `#3d472b` `#272e1b`

Rules of use:
- The rail ground is `--color-neutral-900` (`#2e2b25`). Rail text is
  `--color-neutral-300`/`400`; rail values are `#fff`. **Never `--color-neutral-500`
  for text** — it is 3.46:1 on the rail and fails on the projector especially.
- **Any fill carrying white text must be `--color-accent-700` or
  `--color-accent-2-700` or darker.** `--color-accent` (#c67139) with white text
  measures 3.61:1 and fails AA at every size the system uses. This governs every
  primary button, count badge, escalation chip, and active nav pill.
- Body and label text on the cream ground bottoms out at `--color-neutral-700`;
  `--color-neutral-600` is 3.61:1 on `#f5ead8` and must not carry copy.
- Anything urgent (deadline block, open decision, an at-risk metric) uses the
  accent ramp — `--color-accent-800` fills on the dark rail,
  `--color-accent-100` fills on the light column.
- The sage ramp is a genuine second voice, not a highlight: the projection card
  and the team's own row in the regions table.
- **Do not** reintroduce `emerald` / `blue` / `amber` / `red` Tailwind defaults.
  The four scoring tiers map onto the ramps: OPTIMAL `--color-accent-2-700`,
  ADEQUATE `--color-neutral-700`, INADEQUATE `--color-accent-600`,
  CRITICAL_FAILURE `--color-accent-800`.

### Type

- `--font-heading: "Caprasimo", system-ui, sans-serif` — headings only.
- `--font-body: "Figtree", system-ui, sans-serif` — everything else.
- Load both from Google Fonts in `app/layout.tsx` via `next/font/google`
  (replacing the current Geist wiring). Remove the
  `font-family: Arial, Helvetica, sans-serif` rule on `body` in `globals.css`.

Scale as used in the mock:

| Role | Size / weight | Family |
| --- | --- | --- |
| Page title (`Situation`) | 32px | heading |
| Rail brand (`AFRO Regional Office`) | 24px, line-height 1.15 | heading |
| Card title | 21px | heading |
| Big rail number (deadline) | 34px / 800, letter-spacing −.02em | body |
| Stat value | 20–24px / 700 | body |
| Rail ledger value | 17px / 700 | body |
| Body copy | 15–16px, line-height 1.5–1.6 | body |
| Table cell | 14px | body |
| Section eyebrow | 11–12px / 500, letter-spacing .16em, uppercase | body |

### Spacing, radius, elevation

Take every value from the `--space-*`, `--radius-*` and `--shadow-*` variables
in the token block (they carry a 1.10× density and a 16px base radius). Do not
hard-code px where a variable exists.

- Containers: `--radius-lg` (resolves to 28px — take the variable, don't
  hard-code 16px).
- Buttons, nav pills, chips, inputs: `border-radius: 999px`. This is
  non-negotiable in this system — no 6px `rounded-md` buttons anywhere.
- Elevation: `--shadow-sm/md/lg` only.

### Interaction states

Every interactive element needs a themed hover tint and a pressed state one step
past the base — `--color-accent-600` on the light column, `--color-accent-400`
on the dark rail. Keyboard focus is
`:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }`
on every control. The app currently leaves default browser focus rings on inputs
and selects; that has to go.

## Screens / views

### 1. App shell — `app/(dashboard)/layout.tsx`

This is the whole redesign. It replaces the current header + horizontal nav
strip.

**Layout:** `display: flex`, full viewport height, no page-level max-width.

**Left rail** — fixed `268px`, `flex-shrink: 0`, ground `--color-neutral-900`,
padding `26px 22px`, `display: flex; flex-direction: column; gap: 26px`. Top to
bottom:

1. **Brand block.** Eyebrow `Veiled Horizon` (11px, .18em tracking, uppercase,
   `--color-neutral-500`), then the region name in Caprasimo 24px `#fff`, broken
   over two lines (`AFRO` / `Regional Office`).
2. **Deadline block.** Only rendered when the team has an open dispatch with a
   `deadlineAt` in the future; if several are open, show the soonest. Ground
   `--color-accent-800`, `--radius-lg`, padding `16px 18px`. Eyebrow `Deadline`
   in `--color-accent-300`; the countdown at 34px/800 `#fff`; the event title at
   13px `--color-accent-200`. Ticks every second client-side (reuse the existing
   `DeadlineCountdown` logic from `components/deadline-countdown.tsx`).
3. **Ledger.** Eyebrow `Your ledger`. Seven rows, each a
   `justify-content: space-between` flex line: label 14px `--color-neutral-400`,
   value 17px/700 `#fff`. Order: Fund, PPE days, Antivirals, HCW surge, then a
   1px `--color-neutral-700` divider, then Your Rt, Trust, Tension. **Your Rt
   renders in `--color-accent-300` with a `↑` when it has risen since the last
   poll** — this is the one piece of new behavior and it is the point of the
   redesign. Sourced from the `ownRegion` object the `/api/dashboard` query
   already returns; no new endpoint.
4. **Nav.** Eyebrow `Go to`. Seven pill links, 15px, `padding: 8px 16px`,
   `border-radius: 999px`. Active is a solid `--color-accent` fill with `#fff`
   text and weight 700; inactive is `--color-neutral-300` on transparent, hover
   tints to `--color-neutral-800`. Labels: Situation, Events, Coordination,
   Pledges, Marketplace, Funding, Briefing. Events carries a count badge
   (accent pill, 12px/700) when dispatches are awaiting a response. Sign out
   sits at the very bottom, below the clock.
5. **Clock.** Pushed down with `margin-top: auto`, separated by a 1px
   `--color-neutral-700` top border. Eyebrow `In-game`; value
   `Day 34 · 08:12` at 18px/700 `#fff`; below it a 4px progress track
   (`--color-neutral-700`) filled `--color-accent-400` to
   `clock.gameDayFraction`. Real-elapsed moves out of the header and can be a
   `title` tooltip on this block. Reuse `computeSimClock` / `formatSimClock`
   unchanged.

The rail collapses below `1024px`: it becomes a top bar with the brand, the
deadline countdown, and a hamburger that opens the nav and ledger as a sheet.
The ledger must remain reachable in one tap on mobile.

**Right column** — `flex: 1; min-width: 0`, ground `--color-bg`, padding
`30px 34px`, `display: flex; flex-direction: column; gap: 26px`. Renders
`{children}`.

### 2. Situation — `app/(dashboard)/dashboard/page.tsx`

Same query, same 15s `refetchInterval`, same `DashboardData` shape.

- **Page header row.** `Situation` in Caprasimo 32px on the left; on the right a
  row of: escalation chip (pill, `--color-accent` fill, `#fff`, 14px/700, label
  `Amber`), then `Global Rt 1.42` and `Media 61` as 15px
  `--color-neutral-700` with the value bolded in `--color-text`.
- **Segmented control.** Self-aligned start, ground `--color-neutral-200`,
  `border-radius: 999px`, padding 5px. Options: Overview · All regions ·
  Projection · Recent developments. The selected option is a `--color-bg` pill
  with `--shadow-sm`. This is what replaces the current single long scroll —
  Overview shows the open decision, the visibility gap, and the projection;
  the other tabs isolate the table, the projection detail, and the notifications
  feed.
- **Open-decision banner.** `--color-accent-100`, `--radius-lg`, padding
  `22px 24px`, flex row. Eyebrow `Open decision` in `--color-accent-700`; the
  event title in Caprasimo 21px `--color-accent-900`; a 14px
  `--color-accent-800` line of deadline type and stakes; a solid accent
  `Respond` pill on the right linking to `/events/[dispatchId]`. Hidden when no
  dispatch is awaiting a response.
- **Two-up cards.** `grid-template-columns: 1fr 1fr; gap: 16px`.
  - *Your visibility gap* — ground `--color-surface`. A 26px track showing
    confirmed vs. estimated-true as two nested bars: full-width
    `--color-accent-200` for the estimated range, an inner `--color-accent`
    pill scaled to `confirmedCases / estimatedTrueCasesHigh`. Labels
    `confirmed` / `estimated true` under each end. This replaces the
    `9800-16400` string in the current table and is the clearest teaching moment
    in the app — surface it, don't bury it.
  - *If nothing changes* — ground `--color-accent-2-100`. Three inline stats
    (Now / +14d / +28d) at 24px/700 `--color-accent-2-900`, then the existing
    privacy caveat at 13px `--color-accent-2-700`. Straight port of
    `SituationProjection`, restyled.
- **Regions table.** 14px body font. Header row 12px/500
  `--color-neutral-600` with a 2px `--color-divider` bottom rule; body rows a
  1px rule. The team's own row gets a `--color-accent-2-100` fill and a bold
  region code; its Rt cell is bold `--color-accent-700`. Columns: Region,
  Confirmed, Deaths, Rt, Capacity, Surv.

The blurred `CounterfactualGhost` block keeps its current behavior and copy but
moves to the Recent-developments tab; render the blurred number in
`--color-accent-700`.

### 3. Event detail — `app/(dashboard)/events/[dispatchId]/page.tsx`

The rail persists, and gains one event-scoped block in place of the ledger:
**"Can you afford it?"** — the three resources the event's options actually
cost, plus a 13px `--color-accent-300` line naming the shortfall
(`Option C costs $1.2M — $360K beyond your fund.`). Compute it from the same
`affordabilityIssue()` helper already in the page.

Content column:
- Eyebrow `Event · hard deadline` in `--color-accent-700`, title in Caprasimo
  30px, narrative at 16px/1.6 `--color-neutral-800`.
- **Options** as full-width rows, `--radius-lg`, `2px solid --color-divider`,
  padding `15px 18px`, flex with a Caprasimo letter (A/B/C) at 18px
  `--color-neutral-600` in the gutter. Selected: `2px solid --color-accent` with
  a `--color-accent-100` fill, letter and text in `--color-accent-700/900`,
  weight 600. Unaffordable: `opacity: .45` and non-interactive, with the reason
  in `--color-accent-700` — never a red border.
- **Allocation events** render one tile per region (`--color-surface`,
  `--radius-lg`) plus an `Unallocated` tile in `--color-accent-100` that shows
  the remaining courses and only reads zero when the allocation is complete.
  Submit stays disabled while unallocated ≠ 0.
- Confidence is a three-option segmented pill, not three separate buttons.
- Rationale textarea: `--radius-lg`, `2px solid --color-divider`, 15px.
- Submit: solid `--color-accent` pill, `#fff`, `padding: 12px 30px`, 15px/700.

### 4. Remaining team pages

Events, Coordination, Pledges, Marketplace, Emergency Funding, Profile,
Glossary, Summary all inherit the shell and the same primitives — card =
`--color-surface` or `--color-bg` on `--radius-lg`; every button and select is a
pill; every status word is a ramp-tinted `.tag`-style chip rather than colored
text. Marketplace's incoming-offer block and Emergency Funding's open request
use `--color-accent-100`; Pledges' ledger rows use `--color-accent-2-100`.

## Interactions & behavior

- No new data fetching. Same query keys (`dashboard`, `events`, `coordination`,
  `market`, `trade`, `pledges`, `emergency-funding`) and same intervals.
- The rail's countdown and clock tick locally every second between polls, as
  they do today.
- Rt-rose indicator: keep the previous `ownRegion.rt` in a ref across polls;
  show `↑` in `--color-accent-300` for 30s after an increase. Purely client-side.
- Segmented control state is local (`useState`), not routed.
- Transitions: 150ms ease for hover tints, 1000ms ease for bar widths that
  animate on data change (matches the existing world-health bar).
- Respect `prefers-reduced-motion` for the bar animations.

## Accessibility

- Accent-on-cream is tuned to ~3:1 — fine for chrome, icons, bars, and large
  display numerals, but **paragraph-size accent text must use
  `--color-accent-700` or darker**.
- **White-on-accent is the trap in this palette.** Every solid fill behind white
  text uses the `-700` step of its ramp. Audit each button, chip, and badge
  against 4.5:1 — the bold-text exemption needs ≥18.66px and nothing in this
  system's chrome is that large.
- Every control needs `:focus-visible { outline: 2px solid var(--color-accent);
  outline-offset: 2px; }`.
- Never encode a scoring tier or a status by color alone; the tier word is
  always present.
- The rail nav is a `<nav>` with `aria-current="page"` on the active pill.

## Assets

No new image assets. Icons should be Lucide at `stroke-width: 2.75` if any are
introduced (the current app uses none). Fonts are Caprasimo and Figtree from
Google Fonts.

## Files in this bundle

- `split-console-reference.html` — the Split Console direction, standalone and
  self-contained (tokens inlined, fonts from Google). Two frames: the Situation
  screen with the full rail, and the event screen showing the rail's
  affordability variant. Open it in a browser and measure against it.
- `split-console-system.html` — **the full system: all 24 screens across the four
  surfaces** (public, team, instructor, projector), plus a Primitives panel
  showing the ground, the two accent meanings, the type scale, the pill actions,
  the tier chips, and the segmented control. This is the primary reference.

Also in the design project, for context:

- `WHO Sim - Screen Map.dc.html` — all 21 current screens, recreated from the
  repo source, with a route-to-file map.
- `WHO Sim - Concepts.dc.html` — the three directions explored; Split Console is
  option `1c`.

## Suggested order of work

1. Tokens and fonts in `globals.css` + `app/layout.tsx`. Nothing else changes yet.
2. The shell in `app/(dashboard)/layout.tsx` — rail, nav, clock. Existing pages
   render unstyled inside it and still work.
3. `/dashboard`, then `/events/[dispatchId]` — the two screens in this bundle.
4. The remaining seven team pages against the primitives.
5. `/display/[token]` and the instructor screens — both are specified in
   `split-console-system.html`. The instructor shell reuses the same rail
   component with different cargo (waiting-count and running deadlines in place
   of the ledger); the projector drops the rail entirely and is the only
   full-bleed, dark, no-navigation surface.

## One structural change to confirm

The system merges `/orientation`, `/profile` and `/glossary` into a single
tabbed **Briefing** page (tabs: Your region · The scenario · How you're scored ·
Glossary). Three nav items collapse to one and the region briefing stays
reachable mid-crisis. Everything else is a presentation change only — if this
merge is not wanted, keep the three routes and drop the tabs; nothing else in
the spec depends on it.
