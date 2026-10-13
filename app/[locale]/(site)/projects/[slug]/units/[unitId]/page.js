import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { UnitView } from "@/components/site/UnitView";
import { Skeleton } from "@/components/ui/States";
import { getProject, getProjectUnits, getUnit } from "@/lib/public/api";
import { alternatesFor, pick } from "@/lib/public/site";
import { sizeLabel } from "@/lib/public/units";

export async function generateMetadata({ params }) {
  const { slug, unitId } = await params;
  const [locale, t, unit] = await Promise.all([getLocale(), getTranslations("site.unit"), getUnit(unitId)]);
  if (!unit || unit.project?.slug !== slug) return { title: t("notFoundTitle") };
  const project = pick(unit.project, "name", locale);
  const title = unit.kind === "plot" && unit.plotNo ? t("plotTitle", { no: unit.plotNo }) : t("unitTitle", { code: unit.code });
  return {
    title: `${title} · ${project}`,
    description: t("metaDescription", { title, project, size: sizeLabel(unit, locale) }),
    alternates: alternatesFor(locale, `/projects/${slug}/units/${unitId}`),
  };
}

async function UnitRoute({ params }) {
  const { slug, unitId } = await params;
  const unit = await getUnit(unitId);
  if (!unit) notFound();
  // Old or hand-typed project slug → the one canonical URL.
  if (unit.project.slug !== slug) permanentRedirect(`/${await getLocale()}/projects/${unit.project.slug}/units/${unit.id}`);
  const [project, units] = await Promise.all([getProject(slug), getProjectUnits(slug)]);
  if (!project) notFound();
  return <UnitView unit={unit} project={project} units={units ?? []} />;
}

export default function UnitPage({ params }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 pt-10 sm:px-6 lg:grid-cols-[7fr_5fr] lg:px-8">
          <div className="space-y-6">
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-12 w-1/2" />
            <Skeleton className="aspect-[4/3] w-full rounded-lg" />
          </div>
          <Skeleton className="h-80 w-full rounded-lg" />
        </div>
      }
    >
      <UnitRoute params={params} />
    </Suspense>
  );
}
