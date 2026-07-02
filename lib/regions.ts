// Canonical list of the six WHO region codes used throughout the sim —
// single source of truth so every region picker/dropdown/loop stays in
// sync if a region is ever added or renamed.
export const REGIONS = ["AFRO", "AMRO", "EMRO", "EURO", "SEARO", "WPRO"] as const;
export type RegionId = (typeof REGIONS)[number];
