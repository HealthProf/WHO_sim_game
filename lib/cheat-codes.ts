// Static definitions for the easter-egg cheat code system (see
// components/cheat-code-widget.tsx for the entry UI and lib/cheat-engine.ts
// for what each code actually does server-side). Deliberately not
// discoverable from any visible UI copy — nothing here should ever be
// rendered to a user before they've typed the exact matching sequence.
//
// Codes are matched as a sequence of uppercase, single-keystroke tokens
// rather than a raw string, so "case insensitive" and "arrow keys count as
// one keystroke" both fall out for free — every non-whitespace character
// the user typed becomes its own token (an arrow glyph becomes one
// directional token; any other character becomes itself, uppercased), and
// whitespace is a pure separator that produces no token of its own. This is
// deliberately NOT word-grouped: "IDDQD" is five one-letter tokens back to
// back, exactly like "B" then "A" are two one-letter tokens at the end of
// the Konami code — typing either one is just a run of keystrokes with no
// natural pause, so there's no reliable place to split on "words" anyway.
// Multi-word phrase codes (BARREL_ROLL, MONOLOGUE) work the same way, just
// with the incidental spaces between words dropped rather than treated as
// meaningful.

export const ARROW_GLYPHS = { UP: "↑", DOWN: "↓", LEFT: "←", RIGHT: "→" } as const;
const GLYPH_TO_TOKEN: Record<string, string> = {
  [ARROW_GLYPHS.UP]: "UP",
  [ARROW_GLYPHS.DOWN]: "DOWN",
  [ARROW_GLYPHS.LEFT]: "LEFT",
  [ARROW_GLYPHS.RIGHT]: "RIGHT",
};

export function tokenize(raw: string): string[] {
  const tokens: string[] = [];
  for (const ch of raw) {
    const arrowToken = GLYPH_TO_TOKEN[ch];
    if (arrowToken) {
      tokens.push(arrowToken);
    } else if (!/\s/.test(ch)) {
      tokens.push(ch.toUpperCase());
    }
  }
  return tokens;
}

// Helper for defining a non-arrow code's tokens from its natural-language
// spelling — strips whitespace and splits into one token per character,
// matching what tokenize() above produces for typed input.
function chars(phrase: string): string[] {
  return phrase.replace(/\s+/g, "").toUpperCase().split("");
}

export type CheatCodeKey =
  | "FUNDS_30M"
  | "GOD_MODE"
  | "BARREL_ROLL"
  | "FLIP_COUNTS"
  | "REVERT_TO_ZERO"
  | "MONOLOGUE";

export interface CheatCodeDef {
  key: CheatCodeKey;
  tokens: string[];
  // Who is allowed to trigger this one — "region" codes act on the entering
  // team's own region and make no sense for an instructor actor (who has
  // none), so they're simply treated as a non-match for that role rather
  // than surfacing any distinct error (nothing about *why* a guess failed
  // should ever leak to the user).
  scope: "global" | "region";
  // Shown on the success screen, before the 5s countdown. MONOLOGUE never
  // reaches this screen (see the spec: "does not display anything to the
  // user, just closes the box") so its description is unused by the UI but
  // kept here for completeness/tests.
  description: string;
  // Applied instantly on a correct match rather than after the 5s countdown
  // — only MONOLOGUE, since it explicitly skips the success screen.
  instant: boolean;
}

export const CHEAT_CODES: CheatCodeDef[] = [
  {
    key: "FUNDS_30M",
    tokens: ["UP", "UP", "DOWN", "DOWN", "LEFT", "RIGHT", "LEFT", "RIGHT", "B", "A"],
    scope: "region",
    description: "Your region receives a one-time emergency infusion of $30,000,000. This will be announced to the whole room.",
    instant: false,
  },
  {
    key: "GOD_MODE",
    tokens: chars("IDDQD"),
    scope: "global",
    description: "God Mode: the game's difficulty multiplier is set to 5x. This will be announced to the whole room.",
    instant: false,
  },
  {
    key: "BARREL_ROLL",
    tokens: chars("DO A BARREL ROLL"),
    scope: "global",
    description: "Every screen — including the projector — does a complete barrel roll.",
    instant: false,
  },
  {
    key: "FLIP_COUNTS",
    tokens: chars("ABACABB"),
    scope: "region",
    description: "Your region's death count and infection count swap places.",
    instant: false,
  },
  {
    key: "REVERT_TO_ZERO",
    tokens: ["UP", "DOWN", "LEFT", "RIGHT", "RIGHT", "LEFT", "DOWN", "UP"],
    scope: "region",
    description: "Revert your infection and death counts to zero over the next 14 days of game time.",
    instant: false,
  },
  {
    key: "MONOLOGUE",
    tokens: chars("ONE SHOT TO RULE THEM ALL"),
    scope: "global",
    description: "",
    instant: true,
  },
];

export function matchCheatCode(tokens: string[]): CheatCodeDef | null {
  if (tokens.length === 0) return null;
  for (const code of CHEAT_CODES) {
    if (code.tokens.length !== tokens.length) continue;
    if (code.tokens.every((t, i) => t === tokens[i])) return code;
  }
  return null;
}

export function cheatCodeApplies(code: CheatCodeDef, actorRole: "instructor" | "student"): boolean {
  return code.scope === "global" || actorRole === "student";
}

// The scripted 9-message "Dutch vaccine monopoly" sequence for MONOLOGUE —
// see the task spec for the source text (adapted from what-if.xkcd.com/53).
// Each message is shown for MONOLOGUE_MESSAGE_SECONDS on every screen in the
// session while the whole simulation is paused underneath it.
export const MONOLOGUE_MESSAGE_SECONDS = 5;
export const MONOLOGUE_MESSAGES: string[] = [
  "The Netherlands has developed a 100% effective vaccine that cannot be copied, sequenced, or reverse-engineered by anyone. Global panic ensues. (Also: mild toilet paper shortage. Always.)",
  "The world responds the way you'd expect: fury, then lawsuits, then — once lawsuits fail to produce a vaccine — much quieter, much more urgent phone calls to The Hague.",
  "Every dying nation on Earth is now negotiating with a country of 18 million people previously known mainly for bike lanes and brutally literal furniture assembly instructions.",
  "Belgium capitulates first. Surprising no one who has been paying attention to Belgium. Terms of surrender: permanent access to the vaccine, in exchange for permanent fries seasoning rights.",
  "“The only entity that can stop you from dying” turns out to be excellent leverage. Health ministries now take calls directly from The Hague. WHO meetings are held in Dutch, for “efficiency.”",
  "The UK holds out longest. Officials cite national pride. Everyone else suspects it's mostly about still being mad over the 1600s.",
  "Nations attempting to develop rival vaccines make surprising progress — right up until the Dutch quietly drop prices in that exact country, the research budget quietly disappears, and major pharma houses in that nation immediately go bankrupt and are sold to...the Netherlands.",
  "“Getting vaccinated” and “swearing trade allegiance to the Kingdom of the Netherlands” are now, for most of the planet, the same appointment. The rift between nations who have the vaccine and those who do not has never been wider. There are few holdouts left.",
  "Amsterdam is the de facto capital of a world that never voted for this. Windmills are mandatory rooftop decor in eleven time zones. Maybe we shouldn't have let them make the vaccine.",
];

export const CHEAT_FAIL_WARNING_THRESHOLD = 5;
export const CHEAT_EXECUTE_DELAY_SECONDS = 5;
export const CHEAT_REVERT_DURATION_GAME_DAYS = 14;
export const CHEAT_WINNER_REVEAL_PAUSE_SECONDS = 5;
