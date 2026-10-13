import { notFound } from "next/navigation";
import { getProject, getSiteOrgOrNull } from "@/lib/public/api";
import { formatBDTCompact } from "@/lib/format";
import { OG_SIZE, coverUrl, ogCard, ogPrice } from "@/lib/public/og";
import { placeOf } from "@/components/site/ProjectCard";

/** Share card for a project: cover + name + place + starting price (English — see lib/public/og.js). */
export async function generateImageMetadata({ params }) {
  const { slug } = await params;
  const project = await getProject(slug);
  return [{ id: "card", size: OG_SIZE, contentType: "image/png", alt: project?.name ?? "Project" }];
}

export default async function Image({ params }) {
  const { slug } = await params;
  const [project, org] = await Promise.all([getProject(slug), getSiteOrgOrNull()]);
  if (!project) notFound();
  const from = project.inventory?.priceFrom;
  return ogCard({
    brand: org?.name ?? "",
    eyebrow: placeOf(project.location, "en"),
    title: project.name,
    lines: [project.tagline],
    price: from != null ? ogPrice(formatBDTCompact(from, "en")) : null,
    image: coverUrl(project.cover, project.kind === "plot" ? "plot-land" : "apartment-exterior", project.id),
  });
}
