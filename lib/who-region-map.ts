// Approximate ISO-3166 alpha-3 -> WHO region mapping for map shading. Not
// exhaustive (WHO regional membership has some edge cases) — good enough for
// a projector display; unmapped countries render in neutral gray.
export const countryToRegion: Record<string, string> = {
  // AFRO
  NGA: "AFRO", ETH: "AFRO", COD: "AFRO", TZA: "AFRO", KEN: "AFRO", UGA: "AFRO", GHA: "AFRO",
  CIV: "AFRO", CMR: "AFRO", NER: "AFRO", MLI: "AFRO", MOZ: "AFRO", AGO: "AFRO", MDG: "AFRO",
  ZAF: "AFRO", ZMB: "AFRO", ZWE: "AFRO", SEN: "AFRO", TCD: "AFRO", SOM: "AFRO", RWA: "AFRO",
  BEN: "AFRO", BFA: "AFRO", COG: "AFRO", GAB: "AFRO", GIN: "AFRO", NAM: "AFRO", BWA: "AFRO",
  LSO: "AFRO", SWZ: "AFRO", MWI: "AFRO", LBR: "AFRO", SLE: "AFRO", TGO: "AFRO", GNB: "AFRO",
  GNQ: "AFRO", CAF: "AFRO", ERI: "AFRO", MRT: "AFRO", GMB: "AFRO", BDI: "AFRO", SSD: "AFRO",
  // AMRO
  USA: "AMRO", CAN: "AMRO", MEX: "AMRO", BRA: "AMRO", ARG: "AMRO", COL: "AMRO", PER: "AMRO",
  VEN: "AMRO", CHL: "AMRO", ECU: "AMRO", BOL: "AMRO", PRY: "AMRO", URY: "AMRO", GUY: "AMRO",
  SUR: "AMRO", CUB: "AMRO", HTI: "AMRO", DOM: "AMRO", GTM: "AMRO", HND: "AMRO", NIC: "AMRO",
  CRI: "AMRO", PAN: "AMRO", SLV: "AMRO", JAM: "AMRO", TTO: "AMRO", BLZ: "AMRO", BHS: "AMRO",
  // EMRO
  EGY: "EMRO", SAU: "EMRO", IRN: "EMRO", IRQ: "EMRO", PAK: "EMRO", MAR: "EMRO", DZA: "EMRO",
  SYR: "EMRO", YEM: "EMRO", JOR: "EMRO", TUN: "EMRO", LBY: "EMRO", LBN: "EMRO", OMN: "EMRO",
  KWT: "EMRO", QAT: "EMRO", ARE: "EMRO", AFG: "EMRO", SDN: "EMRO", DJI: "EMRO", BHR: "EMRO",
  // EURO
  RUS: "EURO", DEU: "EURO", GBR: "EURO", FRA: "EURO", ITA: "EURO", ESP: "EURO", POL: "EURO",
  UKR: "EURO", ROU: "EURO", NLD: "EURO", BEL: "EURO", CZE: "EURO", GRC: "EURO", PRT: "EURO",
  SWE: "EURO", HUN: "EURO", AUT: "EURO", CHE: "EURO", BGR: "EURO", SRB: "EURO", DNK: "EURO",
  FIN: "EURO", NOR: "EURO", IRL: "EURO", HRV: "EURO", KAZ: "EURO", UZB: "EURO", TUR: "EURO",
  SVK: "EURO", ISR: "EURO",
  // SEARO
  IND: "SEARO", IDN: "SEARO", BGD: "SEARO", THA: "SEARO", MMR: "SEARO", NPL: "SEARO",
  LKA: "SEARO", PRK: "SEARO", TLS: "SEARO", BTN: "SEARO", MDV: "SEARO",
  // WPRO
  CHN: "WPRO", JPN: "WPRO", PHL: "WPRO", VNM: "WPRO", KOR: "WPRO", MYS: "WPRO", AUS: "WPRO",
  PNG: "WPRO", NZL: "WPRO", SGP: "WPRO", KHM: "WPRO", LAO: "WPRO", MNG: "WPRO", FJI: "WPRO",
};

export const regionColors: Record<string, string> = {
  AFRO: "#f59e0b",
  AMRO: "#3b82f6",
  EMRO: "#a855f7",
  EURO: "#10b981",
  SEARO: "#ef4444",
  WPRO: "#06b6d4",
};

export const regionCentroids: Record<string, [number, number]> = {
  AFRO: [20, 2],
  AMRO: [-80, 10],
  EMRO: [45, 24],
  EURO: [20, 50],
  SEARO: [82, 18],
  WPRO: [130, 10],
};
