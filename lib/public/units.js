import { formatAreaValue, formatLand, formatSqftArea, localizeDigits } from "@/lib/format";

/** Pure helpers for PublicUnit lists (API.md › Public catalogue). Safe on server and client. */

export const isSellable = (u) => u.status === "available" || u.status === "held";

/** "G" / "B1" / "12" (digits localized). `t` = site.units translator. */
export function floorShort(floor, locale, t) {
  if (floor == null) return "—";
  if (floor === 0) return t("groundShort");
  if (floor < 0) return t("basementShort", { n: localizeDigits(-floor, locale) });
  return localizeDigits(floor, locale);
}

/** Size in the unit's own measure: apartments in sft (+ sq m), plots in the deed unit (+ the other). */
export function sizeLabel(u, locale) {
  if (u.kind === "plot") return u.landArea ? formatLand(u.landArea, locale) : "—";
  return formatSqftArea(u.saleableSqft, u.saleableSqm, locale);
}

/** Short size for tight places (grid cells, tooltips): "1,250 sft" / "3.3 decimal". */
export function sizeShort(u, locale) {
  if (u.kind === "plot") return u.landArea ? formatAreaValue(u.landArea.value, u.landArea.unit, locale, 2) : "";
  return u.saleableSqft != null ? formatAreaValue(u.saleableSqft, "sqft", locale, 0) : "";
}

const minOf = (xs) => (xs.length ? Math.min(...xs) : null);
const maxOf = (xs) => (xs.length ? Math.max(...xs) : null);

/**
 * "Unit types" table rows. Apartments group by type label (or bedrooms); plots by road.
 * Each row: { key, label, count, available, minSqft/maxSqft or minLand/maxLand (in the deed unit), fromPrice }.
 */
export function typeRows(units, kind, t) {
  const groups = new Map();
  for (const u of units) {
    let key;
    let label;
    if (kind === "plot") {
      key = `road:${u.road ?? ""}`;
      label = u.road ? t("road", { road: u.road }) : t("otherPlots");
    } else if (u.typeLabel) {
      key = `type:${u.typeLabel}`;
      label = u.typeLabel;
    } else {
      key = `bed:${u.bedrooms ?? "-"}`;
      label = u.bedrooms != null ? t("bedType", { n: u.bedrooms }) : t("otherType");
    }
    if (!groups.has(key)) groups.set(key, { key, label, items: [] });
    groups.get(key).items.push(u);
  }
  return [...groups.values()]
    .map(({ key, label, items }) => {
      const sell = items.filter(isSellable);
      const prices = sell.map((u) => u.price).filter((p) => p != null);
      const row = { key, label, count: items.length, available: items.filter((u) => u.status === "available").length, fromPrice: minOf(prices) };
      if (kind === "plot") {
        const lands = items.map((u) => u.landArea).filter(Boolean);
        const unit = lands[0]?.unit ?? "katha";
        const vals = lands.map((a) => a[unit]).filter((v) => v != null);
        Object.assign(row, { landUnit: unit, minLand: minOf(vals), maxLand: maxOf(vals) });
      } else {
        const sft = items.map((u) => u.saleableSqft).filter((v) => v != null);
        Object.assign(row, { minSqft: minOf(sft), maxSqft: maxOf(sft) });
      }
      return row;
    })
    .sort((a, b) => (a.minSqft ?? a.minLand ?? 0) - (b.minSqft ?? b.minLand ?? 0));
}

/** "1,150–1,420 sft" or a single value. */
export function rangeLabel(row, locale) {
  const [lo, hi, unit] = row.landUnit ? [row.minLand, row.maxLand, row.landUnit] : [row.minSqft, row.maxSqft, "sqft"];
  if (lo == null) return "—";
  const d = unit === "sqft" ? 0 : 2;
  if (lo === hi) return formatAreaValue(lo, unit, locale, d);
  return `${formatAreaValue(lo, unit, locale, d).replace(/\s\S+$/, "")}–${formatAreaValue(hi, unit, locale, d)}`;
}

/** Group a project's units by block id. */
export function byBlock(units) {
  const m = new Map();
  for (const u of units) {
    if (!m.has(u.blockId)) m.set(u.blockId, []);
    m.get(u.blockId).push(u);
  }
  return m;
}
