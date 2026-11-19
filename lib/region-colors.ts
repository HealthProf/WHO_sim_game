// Region identity colors (Release 4). Replaces the old Tailwind defaults,
// which failed a color-vision check badly (AMRO blue vs EMRO purple: CVD
// delta-E 0.9 under deuteranopia, against a target of 8+).
//
// These are the dataviz skill's validated categorical slots 1-6 in fixed
// order (blue, orange, aqua, yellow, magenta, green), assigned in REGIONS
// order and never re-ordered or cycled. Validated with
// scripts/validate_palette.js against this app's surfaces:
// - light (#f5ead8): all hard checks pass; four slots are under 3:1
//   contrast, so every chart and map that uses them carries direct region
//   labels and a data table (the "relief" rule).
// - dark projector (#2e2b25): all checks pass, including contrast.
// Six colors can't all be pairwise-separable for color-blind viewers, so
// identity is never color-alone: region codes are always printed alongside.
import type { RegionId } from "./regions";

export const REGION_COLORS_LIGHT: Record<RegionId | string, string> = {
  AFRO: "#2a78d6",
  AMRO: "#eb6834",
  EMRO: "#1baf7a",
  EURO: "#eda100",
  SEARO: "#e87ba4",
  WPRO: "#008300",
};

export const REGION_COLORS_DARK: Record<RegionId | string, string> = {
  AFRO: "#3987e5",
  AMRO: "#d95926",
  EMRO: "#199e70",
  EURO: "#c98500",
  SEARO: "#d55181",
  WPRO: "#0ca30c",
};

export function regionColor(regionId: string, theme: "light" | "dark"): string {
  const map = theme === "dark" ? REGION_COLORS_DARK : REGION_COLORS_LIGHT;
  return map[regionId] ?? (theme === "dark" ? "#82796a" : "#a19786");
}
