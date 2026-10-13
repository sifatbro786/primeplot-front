/**
 * Website unit vocabulary (API: available | held | sold | unavailable). Same tokens as the
 * dashboard grid; "unavailable" uses the blocked hatch. Literal class strings for Tailwind.
 */
export const PUBLIC_STATUSES = ["available", "held", "sold", "unavailable"];

export const PUBLIC_SWATCH = {
  available: "bg-status-available",
  held: "bg-status-held",
  sold: "bg-status-sold",
  unavailable: "bg-status-blocked hatch",
};

export const PUBLIC_CELL = {
  available: "bg-status-available/12 border-status-available/55 hover:bg-status-available/22",
  held: "bg-status-held/14 border-status-held/55 hover:bg-status-held/22",
  sold: "bg-status-sold/12 border-status-sold/45",
  unavailable: "hatch bg-surface border-status-blocked/50",
};

/** Plan hotspot tone (PlanCanvas TONES keys). */
export const PUBLIC_TONE = { available: "available", held: "held", sold: "sold", unavailable: "blocked" };

/** Budget filter on the project's starting price, in poisha (৳1 = 100). */
const LAKH = 100_000 * 100;
const CRORE = 100 * LAKH;
export const BUDGETS = {
  upto50l: [0, 50 * LAKH],
  l50to1c: [50 * LAKH, CRORE],
  c1to2c: [CRORE, 2 * CRORE],
  above2c: [2 * CRORE, Infinity],
};
