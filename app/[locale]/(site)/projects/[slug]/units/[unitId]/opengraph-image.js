import { notFound } from "next/navigation";
import { getProject, getSiteOrgOrNull, getUnit } from "@/lib/public/api";
import { formatAreaValue, formatBDTCompact } from "@/lib/format";
import { OG_SIZE, coverUrl, ogCard, ogPrice } from "@/lib/public/og";

const titleOf = (u) => (u.kind === "plot" && u.plotNo ? `Plot ${u.plotNo}` : `Unit ${u.code}`);

/** Share card for a unit: project cover + unit + size + price (English — see lib/public/og.js). */
export async function generateImageMetadata({ params }) {
  const { unitId } = await params;
  const unit = await getUnit(unitId);
  return [{ id: "card", size: OG_SIZE, contentType: "image/png", alt: unit ? `${titleOf(unit)} · ${unit.project.name}` : "Unit" }];
}

export default async function Image({ params }) {
  const { slug, unitId } = await params;
  const [unit, project, org] = await Promise.all([getUnit(unitId), getProject(slug), getSiteOrgOrNull()]);
  if (!unit || !project || unit.project.slug !== slug) notFound();
  const isPlot = unit.kind === "plot";
  const size = isPlot
    ? unit.landArea && formatAreaValue(unit.landArea.value, unit.landArea.unit, "en", 2)
    : unit.saleableSqft != null && formatAreaValue(unit.saleableSqft, "sqft", "en", 0);
  const details = [
    size,
    !isPlot && unit.bedrooms != null && `${unit.bedrooms} bed`,
    !isPlot && unit.floor != null && (unit.floor === 0 ? "Ground floor" : unit.floor > 0 ? `Floor ${unit.floor}` : `Basement ${-unit.floor}`),
    isPlot && unit.road && `Road ${unit.road}${unit.roadWidthFt ? ` (${unit.roadWidthFt} ft)` : ""}`,
  ].filter(Boolean);
  return ogCard({
    brand: org?.name ?? "",
    eyebrow: project.name,
    title: titleOf(unit),
    lines: [details.join("  ·  ")],
    price: unit.price != null ? ogPrice(formatBDTCompact(unit.price, "en")) : null,
    priceLabel: "Price",
    image: coverUrl(project.cover, isPlot ? "plot-land" : "apartment-exterior", project.id),
  });
}
