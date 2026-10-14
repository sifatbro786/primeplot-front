import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { AboutSections } from "@/components/site/sections/AboutSections";
import { Skeleton } from "@/components/ui/States";
import { getPublishedProjectsOrDefer, getSiteOrgOrNull, getSitePageOrDefer } from "@/lib/public/api";
import { buildMetadata } from "@/lib/public/seo";
import { pick } from "@/lib/public/site";

export async function generateMetadata() {
  const [locale, t, ts, org] = await Promise.all([getLocale(), getTranslations("site.about"), getTranslations("site"), getSiteOrgOrNull()]);
  const name = pick(org, "name", locale) || ts("brandFallback");
  return buildMetadata({ key: "about", locale, path: "/about", company: name, title: t("metaTitle"), description: t("metaDescription", { name }) });
}

async function AboutBody() {
  const [page, projects, org] = await Promise.all([getSitePageOrDefer("about"), getPublishedProjectsOrDefer(), getSiteOrgOrNull()]);
  return <AboutSections page={page} projects={projects} org={org} />;
}

export default function AboutPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-16 h-96 w-full max-w-7xl" />}>
      <AboutBody />
    </Suspense>
  );
}
