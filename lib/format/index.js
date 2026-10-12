/**
 * Display formatting for BN/EN. Pure functions — safe on server and client.
 * Money arrives from the API as INTEGER POISHA (৳1 = 100) and is only converted here.
 * Grouping is South-Asian (lakh/crore): 1,25,50,000 — `en-IN` / `bn-BD` give that natively.
 */

const TZ = "Asia/Dhaka";
const intlLocale = (locale) => (locale === "bn" ? "bn-BD" : "en-IN");

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
export function toBnDigits(value) {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[d]);
}
export function localizeDigits(value, locale) {
  return locale === "bn" ? toBnDigits(value) : String(value);
}

const nfCache = new Map();
function nf(locale, opts = {}) {
  const key = `${locale}|${JSON.stringify(opts)}`;
  let f = nfCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(intlLocale(locale), opts);
    nfCache.set(key, f);
  }
  return f;
}

export function formatNumber(n, locale = "bn", opts) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return nf(locale, opts).format(n);
}

/** Integer poisha → "৳ 1,25,50,000" (decimals only when there are paisa, or when forced). */
export function formatBDT(poisha, locale = "bn", { decimals } = {}) {
  if (poisha == null) return "—";
  const taka = Number(poisha) / 100;
  const showDecimals = decimals ?? !Number.isInteger(taka);
  const value = nf(locale, {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(taka);
  return `৳ ${value}`;
}

const UNITS = {
  bn: { crore: "কোটি", lakh: "লাখ" },
  en: { crore: "crore", lakh: "lakh" },
};

/** Integer poisha → "৳ 1.26 crore" / "৳ ৮৫ লাখ" for cards and headlines (rounded down). */
export function formatBDTCompact(poisha, locale = "bn") {
  if (poisha == null) return "—";
  const taka = Number(poisha) / 100;
  const u = UNITS[locale] ?? UNITS.en;
  const trunc2 = (x) => Math.floor(x * 100) / 100; // never round a price UP
  if (taka >= 1e7) return `৳ ${formatNumber(trunc2(taka / 1e7), locale, { maximumFractionDigits: 2 })} ${u.crore}`;
  if (taka >= 1e5) return `৳ ${formatNumber(trunc2(taka / 1e5), locale, { maximumFractionDigits: 2 })} ${u.lakh}`;
  return formatBDT(poisha, locale, { decimals: false });
}

/** Floor area in square feet. */
export function formatSft(sft, locale = "bn") {
  if (sft == null) return "—";
  return `${formatNumber(sft, locale)} ${locale === "bn" ? "বর্গফুট" : "sft"}`;
}

const DATE_STYLES = {
  date: { day: "numeric", month: "short", year: "numeric" },
  long: { day: "numeric", month: "long", year: "numeric" },
  datetime: { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" },
  time: { hour: "numeric", minute: "2-digit" },
};

/** Always rendered in Bangladesh time, whatever the viewer's machine says. */
export function formatDate(value, locale = "bn", style = "date") {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: TZ, ...DATE_STYLES[style] }).format(d);
}

/** "+8801712345678" → "+880 1712-345678" (Bangla digits in bn). */
export function formatPhone(e164, locale = "en") {
  const m = /^\+880(1\d{3})(\d{6})$/.exec(e164 ?? "");
  if (!m) return e164 ?? "";
  return localizeDigits(`+880 ${m[1]}-${m[2]}`, locale);
}

// ── Areas (owner decision 2026-10-12; backend stores every unit, see API.md › Area units) ──

const AREA_UNIT = {
  bn: { katha: "কাঠা", decimal: "শতাংশ", sqft: "বর্গফুট", sqm: "বর্গমিটার" },
  en: { katha: "katha", decimal: "decimal", sqft: "sft", sqm: "sq m" },
};

export function areaUnitLabel(unit, locale = "bn") {
  return (AREA_UNIT[locale] ?? AREA_UNIT.en)[unit] ?? unit;
}

/** One measure: "৩.৩ শতাংশ". */
export function formatAreaValue(value, unit, locale = "bn", maxDecimals = 4) {
  if (value == null) return "—";
  return `${formatNumber(value, locale, { maximumFractionDigits: maxDecimals })} ${areaUnitLabel(unit, locale)}`;
}

/**
 * Land: the entered (deed) unit first, the other in brackets —
 * "৩.৩ শতাংশ (১.৯৯৬৫ কাঠা)". `LandArea` = { value, unit, katha, decimal, sqft, sqm }.
 */
export function formatLand(area, locale = "bn") {
  if (!area) return "—";
  const other = area.unit === "katha" ? "decimal" : "katha";
  return `${formatAreaValue(area.value, area.unit, locale)} (${formatAreaValue(area[other], other, locale)})`;
}

/** Apartment: "১,২৫০ বর্গফুট (১১৬.১৩ বর্গমিটার)". */
export function formatSqftArea(sqft, sqm, locale = "bn") {
  if (sqft == null) return "—";
  const main = formatAreaValue(sqft, "sqft", locale, 2);
  return sqm == null ? main : `${main} (${formatAreaValue(sqm, "sqm", locale, 2)})`;
}

// ── Money input (taka in forms ↔ integer poisha in the API) ──

/** "8,500.5" → 850050 (exact; null when empty/invalid or more than 2 decimals). */
export function takaToPoisha(input) {
  if (input == null) return null;
  const s = String(input).replace(/[,\s৳]/g, "").replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)));
  if (s === "") return null;
  const m = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const poisha = Number(m[2]) * 100 + Number((m[3] ?? "").padEnd(2, "0") || 0);
  return m[1] ? -poisha : poisha;
}

/** 850050 → "8500.5" for an input's default value (no grouping, no symbol). */
export function poishaToTaka(poisha) {
  if (poisha == null) return "";
  const neg = poisha < 0;
  const abs = Math.abs(poisha);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return `${neg ? "-" : ""}${whole}${frac ? `.${String(frac).padStart(2, "0").replace(/0$/, "")}` : ""}`;
}
