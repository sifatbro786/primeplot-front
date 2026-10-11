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
