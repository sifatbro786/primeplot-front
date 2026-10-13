/**
 * Conversion events for whichever tags are loaded (client only). A no-op when the visitor has not
 * consented or no IDs are set — callers never need to check.
 *
 * GA4 names follow Google's recommended events; Meta gets its standard events so they can be used
 * for ad optimisation without custom conversions.
 */
const META = {
  generate_lead: ["Lead"],
  contact_call: ["Contact", { method: "phone" }],
  contact_whatsapp: ["Contact", { method: "whatsapp" }],
};

export function track(name, params = {}) {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", name, params);
    const meta = META[name];
    if (meta && window.fbq) window.fbq("track", meta[0], { ...meta[1], ...params });
  } catch {
    // Tracking must never break the page.
  }
}
