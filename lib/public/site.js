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

/**
 * Home hero video. Owner decision 2026-10-13: a free Pexels clip for now; later drop your own
 * file in public/ and set NEXT_PUBLIC_HERO_VIDEO=/videos/hero.mp4 (+ NEXT_PUBLIC_HERO_POSTER).
 * Sources are tried in order — if one URL fails the browser moves to the next.
 * Keep a hero file short (10–20 s), muted, H.264 MP4, under ~10 MB.
 */
const PEXELS_ID = "7578541"; // "An exterior design of a modern house" — Pexels licence, free to use
export const HERO_MEDIA = process.env.NEXT_PUBLIC_HERO_VIDEO
  ? {
      sources: [process.env.NEXT_PUBLIC_HERO_VIDEO],
      poster: process.env.NEXT_PUBLIC_HERO_POSTER || null,
    }
  : {
      sources: [
        `https://videos.pexels.com/video-files/${PEXELS_ID}/${PEXELS_ID}-hd_1920_1080_30fps.mp4`,
        `https://videos.pexels.com/video-files/${PEXELS_ID}/${PEXELS_ID}-uhd_2560_1440_30fps.mp4`,
      ],
      poster: `https://images.pexels.com/videos/${PEXELS_ID}/apartment-at-home-business-buy-${PEXELS_ID}.jpeg?auto=compress&cs=tinysrgb&w=1920`,
    };

/** Enquiry form submit switch — stays off until the Leads module (B3) accepts website leads. */
export const LEADS_ENABLED = process.env.NEXT_PUBLIC_LEADS_ENABLED === "true";

/** Unit comparison: at most this many homes side by side (/compare?u=…). */
export const COMPARE_MAX = 3;
