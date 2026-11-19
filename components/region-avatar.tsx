import { regionColor } from "@/lib/region-colors";
import { MOOD_LABEL, type Mood } from "@/lib/avatar-mood";

// Each region's mascot (Release 4): an abstract round emblem in the region's
// identity color with a simple face, deliberately not a person, so it can't
// read as a caricature of the people of a region. Its expression follows the
// region's state (lib/avatar-mood.ts). Usable inside HTML (standalone) or
// inside another SVG (asGroup).
const INK = "#201e1d";

function Face({ mood }: { mood: Mood }) {
  const eyes = mood === "shocked" ? 2.6 : 2.2;
  return (
    <g stroke={INK} strokeLinecap="round" fill="none" strokeWidth={1.8}>
      {/* brows */}
      {mood === "worried" && (
        <>
          <path d="M8.5 10.2 L12 9" />
          <path d="M19.5 10.2 L16 9" />
        </>
      )}
      {mood === "distressed" && (
        <>
          <path d="M8.5 9 L12 10.6" />
          <path d="M19.5 9 L16 10.6" />
        </>
      )}
      {mood === "shocked" && (
        <>
          <path d="M8.5 8.6 Q10.2 7.4 12 8.4" />
          <path d="M19.5 8.6 Q17.8 7.4 16 8.4" />
        </>
      )}
      {/* eyes */}
      <circle cx={10.5} cy={12.6} r={eyes / 2} fill={INK} stroke="none" />
      <circle cx={17.5} cy={12.6} r={eyes / 2} fill={INK} stroke="none" />
      {/* mouth */}
      {mood === "thriving" && <path d="M9.5 16.5 Q14 21.5 18.5 16.5" />}
      {mood === "calm" && <path d="M10.5 17.5 Q14 19.2 17.5 17.5" />}
      {mood === "worried" && <path d="M10.5 18.6 Q14 17.4 17.5 18.6" />}
      {mood === "distressed" && <path d="M10 19.4 Q14 15.8 18 19.4" />}
      {mood === "shocked" && <ellipse cx={14} cy={18.4} rx={2} ry={2.6} fill={INK} stroke="none" />}
      {/* a sweat drop when distressed */}
      {mood === "distressed" && <path d="M21.6 7.5 Q23.2 10 21.6 11 Q20 10 21.6 7.5 Z" fill="#9fd3ff" stroke={INK} strokeWidth={0.8} />}
      {/* cheeks when thriving */}
      {mood === "thriving" && (
        <>
          <circle cx={8} cy={16} r={1.4} fill="#ffffff" fillOpacity={0.45} stroke="none" />
          <circle cx={20} cy={16} r={1.4} fill="#ffffff" fillOpacity={0.45} stroke="none" />
        </>
      )}
    </g>
  );
}

export function RegionAvatar({
  regionId,
  mood,
  size = 40,
  theme = "light",
  asGroup = false,
}: {
  regionId: string;
  mood: Mood;
  size?: number;
  theme?: "light" | "dark";
  asGroup?: boolean;
}) {
  const label = `${regionId} is ${MOOD_LABEL[mood]}`;
  const body = (
    <>
      <title>{label}</title>
      <circle cx={14} cy={14} r={12.5} fill={regionColor(regionId, theme)} stroke={theme === "dark" ? "#f9f4ed" : "#201e1d"} strokeWidth={1.2} />
      <Face mood={mood} />
    </>
  );
  if (asGroup) {
    return (
      <g role="img" aria-label={label} transform={`scale(${size / 28})`}>
        {body}
      </g>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" role="img" aria-label={label} className="shrink-0">
      {body}
    </svg>
  );
}
