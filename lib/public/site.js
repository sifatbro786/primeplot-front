/**
 * Public-site helpers shared by server and client code (no secrets here).
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

/** Off by default: dev/staging must never be indexed. Set NEXT_PUBLIC_ALLOW_INDEXING=true on the live domain. */
export const ALLOW_INDEXING = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";

export const MAP_STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron";

/** Bangla field when the page is Bangla and the field is filled, else English: pick(p, "name", "bn"). */
export function pick(obj, field, locale) {
  if (!obj) return "";
  const bn = obj[`${field}Bn`];
  return (locale === "bn" && bn) || obj[field] || bn || "";
}

/** Highlights are [{ en, bn }]. */
export const pickPair = (pair, locale) => (locale === "bn" ? pair?.bn || pair?.en : pair?.en || pair?.bn) || "";

/** Absolute URL for a locale-less path ("/projects/x") in a locale. */
export const absoluteUrl = (locale, path = "") => `${SITE_URL}/${locale}${path === "/" ? "" : path}`;

/** canonical + hreflang (bn, en, x-default → bn) for metadata.alternates. */
export function alternatesFor(locale, path = "") {
  return {
    canonical: absoluteUrl(locale, path),
    languages: { bn: absoluteUrl("bn", path), en: absoluteUrl("en", path), "x-default": absoluteUrl("bn", path) },
  };
}

/** Robots meta for every public page (the switch above wins over everything). */
export const robotsMeta = ALLOW_INDEXING ? { index: true, follow: true } : { index: false, follow: false };

/** JSON-LD script body, safe against </script> injection from CMS text. */
export const jsonLd = (data) => JSON.stringify(data).replace(/</g, "\\u003c");

/** Installment / EMI calculator defaults (owner-approved 2026-10-13; editable here until a settings screen exists). */
export const CALCULATOR = {
  downPaymentPct: 30,
  downPaymentMin: 10,
  downPaymentMax: 70,
  months: 36,
  monthsMin: 6,
  monthsMax: 60,
  monthsStep: 6,
  showLoan: false, // owner 2026-10-13: bank-loan part off for now — flip to true to offer it
  loanRatePct: 9,
  loanYears: 15,
  loanYearsMax: 25,
};

/** Tel/WhatsApp links from an E.164 number. */
export const telHref = (e164) => (e164 ? `tel:${e164}` : null);
export const whatsappHref = (e164) => (e164 ? `https://wa.me/${e164.replace(/^\+/, "")}` : null);
