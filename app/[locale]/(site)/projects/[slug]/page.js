import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ProjectView } from "@/components/site/ProjectView";
import { Skeleton } from "@/components/ui/States";
import { getProject, getProjectUnits, getProjectUpdates } from "@/lib/public/api";
import { buildMetadata } from "@/lib/public/seo";
import { pick } from "@/lib/public/site";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const [locale, t, project] = await Promise.all([getLocale(), getTranslations("site.project"), getProject(slug)]);
  if (!project) return { title: t("notFoundTitle") };
  const name = pick(project, "name", locale);
  const description =
    pick(project, "tagline", locale) || pick(project, "description", locale).slice(0, 160) || t("metaDescription", { name });
  // og:image: the project's SEO share image if set, else ./opengraph-image.js (name + price card).
  return buildMetadata({
    seo: project.seo ?? null,
    locale,
    path: `/projects/${project.slug}`,
    company: name,
    title: name,
    description,
    openGraph: { type: "website" },
  });
}

function ProjectSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
      <Skeleton className="h-3 w-48" />
      <div className="mt-10 grid gap-10 lg:grid-cols-[5fr_7fr]">
        <div className="space-y-4">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-14 w-4/5" />
          <Skeleton className="h-5 w-3/5" />
        </div>
        <Skeleton className="aspect-[4/3] w-full rounded-lg" />
      </div>
    </div>
  );
}

async function ProjectRoute({ params }) {
  const { slug } = await params;
  const [project, units, updates] = await Promise.all([getProject(slug), getProjectUnits(slug), getProjectUpdates(slug)]);
  if (!project) notFound();
  return <ProjectView project={project} units={units ?? []} updates={updates?.items ?? []} />;
}

export default function ProjectPage({ params }) {
  // The slug is request data (no build-time list): the shell is the skeleton, the page streams in.
  return (
    <Suspense fallback={<ProjectSkeleton />}>
      <ProjectRoute params={params} />
    </Suspense>
  );
}
