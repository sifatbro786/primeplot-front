import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ContactBand } from "@/components/site/ContactBand";
import { PublicPlanViewer } from "@/components/site/PublicPlanViewer";
import { Skeleton } from "@/components/ui/States";
import { getFloorPlan, getProject } from "@/lib/public/api";
import { alternatesFor, pick } from "@/lib/public/site";
import { floorShort } from "@/lib/public/units";

const floorParam = (v) => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n >= -5 && n <= 200 ? n : undefined;
};

/** Plan for the URL floor; a floor this plan doesn't cover falls back to its first floor. */
async function loadPlan(slug, planId, floor) {
  const project = await getProject(slug);
  if (!project) return {};
  const listed = project.floorPlans?.find((p) => p.id === planId);
  if (!listed) return { project };
  const f = listed.kind === "floor" && listed.floors.includes(floor) ? floor : undefined;
  return { project, plan: await getFloorPlan(slug, planId, f) };
}

export async function generateMetadata({ params }) {
  const { slug, planId } = await params;
  const [locale, t] = await Promise.all([getLocale(), getTranslations("site.plan")]);
  const { project, plan } = await loadPlan(slug, planId);
  if (!plan) return { title: t("notFoundTitle") };
  const name = pick(project, "name", locale);
  const title = `${pick(plan, "title", locale)} · ${name}`;
  return {
    title,
    description: t("metaDescription", { name }),
    alternates: alternatesFor(locale, `/projects/${slug}/plans/${planId}`),
  };
}

async function PlanRoute({ params, searchParams }) {
  const [{ slug, planId }, sp, locale, t, tu, tsite] = await Promise.all([
    params,
    searchParams,
    getLocale(),
    getTranslations("site.plan"),
    getTranslations("site.units"),
    getTranslations("site"),
  ]);
  const { project, plan } = await loadPlan(slug, planId, floorParam(sp.floor));
  if (!plan) notFound();
  const name = pick(project, "name", locale);
  const block = project.blocks?.find((b) => b.id === plan.blockId);
  const subtitle =
    plan.kind === "master"
      ? t("sitePlan")
      : [pick(block, "name", locale), plan.floors.length > 1 ? t("typicalFloors") : t("floorN", { floor: floorShort(plan.floor, locale, tu) })]
          .filter(Boolean)
          .join(" · ");

  return (
    <>
      <div className="mx-auto w-full max-w-7xl px-4 pt-8 pb-20 sm:px-6 lg:px-8">
        <Breadcrumbs
          locale={locale}
          label={t("breadcrumb")}
          items={[
            { href: "/", label: tsite("nav.home") },
            { href: "/projects", label: tsite("nav.projects") },
            { href: `/projects/${project.slug}`, label: name },
            { label: pick(plan, "title", locale) },
          ]}
        />
        <header className="mt-8 mb-8">
          <p className="eyebrow">{name}</p>
          <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">{pick(plan, "title", locale)}</h1>
          <p className="mt-3 text-sm text-ink-muted">{subtitle}</p>
        </header>
        <PublicPlanViewer project={{ id: project.id, slug: project.slug, kind: project.kind }} initialPlan={plan} />
      </div>
      <ContactBand title={t("contactTitle", { name })} body={t("contactBody")} />
    </>
  );
}

export default function PlanPage({ params, searchParams }) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
          <Skeleton className="h-3 w-56" />
          <Skeleton className="mt-10 h-12 w-2/3" />
          <Skeleton className="mt-8 aspect-[16/10] w-full rounded-lg" />
        </div>
      }
    >
      <PlanRoute params={params} searchParams={searchParams} />
    </Suspense>
  );
}
