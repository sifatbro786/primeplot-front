/** Unit status machine (ARCHITECTURE §5) → colour group. Shared by server and client code.
 *  Full class names on purpose: Tailwind only generates classes it can see in source. */
export const UNIT_STATUS_SWATCH = {
  available: "bg-status-available",
  held: "bg-status-held",
  booked: "bg-status-booked",
  allotted: "bg-status-sold",
  registered: "bg-status-sold",
  handed_over: "bg-status-sold",
  cancelled: "bg-status-blocked",
  blocked: "bg-status-blocked hatch",
};

export const UNIT_STATUSES = Object.keys(UNIT_STATUS_SWATCH);

/** Tinted cell for the inventory grid / plot tiles (text stays ink; blocked adds the hatch). */
export const UNIT_STATUS_CELL = {
  available: "bg-status-available/12 border-status-available/55 hover:bg-status-available/20",
  held: "bg-status-held/14 border-status-held/55 hover:bg-status-held/22",
  booked: "bg-status-booked/14 border-status-booked/55 hover:bg-status-booked/22",
  allotted: "bg-status-sold/14 border-status-sold/55 hover:bg-status-sold/22",
  registered: "bg-status-sold/14 border-status-sold/55 hover:bg-status-sold/22",
  handed_over: "bg-status-sold/14 border-status-sold/55 hover:bg-status-sold/22",
  cancelled: "bg-surface-2 border-status-blocked/50 hover:bg-surface-3",
  blocked: "hatch bg-surface border-status-blocked/55 hover:bg-surface-2",
};

export const SOLD_STATUSES = ["booked", "allotted", "registered", "handed_over"];
export const BLOCK_REASONS = ["landowner_share", "management_reserve", "legal_issue", "not_for_sale", "other"];
export const FACINGS = ["north", "south", "east", "west", "north_east", "north_west", "south_east", "south_west"];
