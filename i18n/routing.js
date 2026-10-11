import { defineRouting } from "next-intl/routing";

/**
 * Locale lives in the URL (/bn/…, /en/…) — not only in a cookie — because:
 *  - with `cacheComponents`, reading a cookie in the root layout (for <html lang>) would make
 *    every page request-bound; a root param keeps static shells per locale;
 *  - the public site needs crawlable, hreflang-able URLs per language.
 * The cookie still remembers the choice so "/" lands on the right language next time.
 */
export const routing = defineRouting({
  locales: ["bn", "en"],
  defaultLocale: "bn",
  localePrefix: "always",
  localeCookie: { name: "pp_locale", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" },
});

export const LOCALES = routing.locales;
