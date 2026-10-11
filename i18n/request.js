import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { routing } from "./routing";

// `locale` is set only when a caller passes one explicitly (e.g. getTranslations({ locale })).
// Otherwise read the [locale] root param — no cookies/headers, so pages stay prerenderable.
export default getRequestConfig(async ({ locale }) => {
  const requested = locale ?? (await rootLocale());
  const resolved = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale: resolved,
    messages: (await import(`../messages/${resolved}.json`)).default,
    timeZone: "Asia/Dhaka",
  };
});
