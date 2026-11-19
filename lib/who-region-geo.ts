// WHO regional membership for the countries in world-atlas's countries-110m
// map (Release 4 world map), keyed by ISO 3166-1 numeric code as that file
// uses. Areas that are not WHO member states, or whose assignment isn't
// clear-cut, are deliberately left unmapped and render in neutral gray with
// a legend note, rather than the map taking a position: Taiwan (158),
// Kosovo, Western Sahara (732), Falkland Is. (238), Greenland (304),
// Antarctica (010) and the French Southern Lands (260).
//
// Based on WHO's published regional groupings; please flag any you think
// should change. Small states missing from the 110m map (e.g. Bahrain,
// Maldives, most Pacific and Caribbean island states) simply don't appear.
import type { RegionId } from "./regions";

const BY_REGION: Record<RegionId, string[]> = {
  AFRO: [
    "012", "024", "204", "072", "854", "108", "120", "140", "148", "178", "180", "384", "226", "232", "748", "231", "266", "270",
    "288", "324", "624", "404", "426", "430", "450", "454", "466", "478", "508", "516", "562", "566", "646", "686", "694", "710",
    "728", "834", "768", "800", "894", "716",
  ],
  AMRO: [
    "124", "840", "484", "320", "084", "340", "222", "558", "188", "591", "192", "332", "214", "388", "044", "780", "630", "170",
    "862", "328", "740", "218", "604", "076", "068", "600", "152", "032", "858",
  ],
  EMRO: ["004", "262", "818", "364", "368", "400", "414", "422", "434", "504", "512", "586", "275", "634", "682", "706", "729", "760", "788", "784", "887"],
  EURO: [
    "008", "051", "040", "031", "112", "056", "070", "100", "191", "196", "203", "208", "233", "246", "250", "268", "276", "300",
    "348", "352", "372", "376", "380", "398", "417", "428", "440", "442", "807", "498", "499", "528", "578", "616", "620", "642",
    "643", "688", "703", "705", "724", "752", "756", "762", "792", "795", "804", "826", "860",
  ],
  SEARO: ["050", "064", "408", "356", "360", "104", "524", "144", "764", "626"],
  WPRO: ["036", "096", "116", "156", "242", "392", "418", "458", "496", "554", "598", "608", "410", "090", "548", "704", "540"],
};

export const NUMERIC_TO_REGION: Record<string, RegionId> = Object.fromEntries(
  (Object.entries(BY_REGION) as [RegionId, string[]][]).flatMap(([region, ids]) => ids.map((id) => [id, region]))
);

// A few 110m features carry no numeric id; matched by name instead.
export const NAME_TO_REGION: Record<string, RegionId> = {
  Somaliland: "EMRO", // part of Somalia
  "N. Cyprus": "EURO", // part of Cyprus
};

export function regionForFeature(id: string | number | undefined, name: string | undefined): RegionId | null {
  if (id != null && NUMERIC_TO_REGION[String(id).padStart(3, "0")]) return NUMERIC_TO_REGION[String(id).padStart(3, "0")];
  if (name && NAME_TO_REGION[name]) return NAME_TO_REGION[name];
  return null;
}

export const EXCLUDED_FROM_MAP = new Set(["010"]); // Antarctica: drawn nowhere
