"use client";

import { ArrowUpRight, FileText, Globe, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { Tag } from "@/components/ui/Tag";
import { Link } from "@/i18n/navigation";
import { errorMessage } from "@/lib/auth/session";
import { formatDate, formatNumber } from "@/lib/format";
import { usePages } from "@/lib/site/queries";
import { PAGE_PATHS } from "@/lib/site/schema";

/** Website: pages with editable content, SEO-only pages, site-wide SEO (B2b). */
export function WebsitePage() {
  const t = useTranslations("website");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const q = usePages();

  const status = (p) =>
    !p.publishedAt ? <Tag tone="warning">{t("neverPublished")}</Tag> : p.hasChanges ? <Tag tone="warning">{t("unpublishedChanges")}</Tag> : <Tag tone="success">{t("live")}</Tag>;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h2 className="mt-3 font-display text-4xl leading-tight">{t("title")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t("description")}</p>
        </div>
        <Button as={Link} href="/dashboard/website/seo" variant="secondary">
          <Search aria-hidden className="size-4" />
          {t("siteSeoLink")}
        </Button>
      </header>

      {q.isError ? (
        <ErrorState title={t("loadFailed")} description={errorMessage(te, q.error)} requestId={q.error?.requestId} requestIdLabel={tc("requestId")} className="mt-8" />
      ) : q.isPending ? (
        <Skeleton className="mt-8 h-72 w-full" />
      ) : (
        <>
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {q.data
              .filter((p) => p.sections > 0)
              .map((p) => (
                <li key={p.key}>
                  <Link href={`/dashboard/website/${p.key}`} className="group flex h-full flex-col rounded-lg border border-line bg-surface p-6 transition-colors hover:border-line-strong">
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid size-10 place-items-center rounded-md border border-line bg-surface-2">
                        <Globe aria-hidden className="size-5 text-accent" strokeWidth={1.5} />
                      </span>
                      {status(p)}
                    </div>
                    <h3 className="mt-5 font-display text-2xl group-hover:underline">{t(`pages.${p.key}`)}</h3>
                    <p className="mt-1 text-sm text-ink-muted">{t(`pagesDesc.${p.key}`)}</p>
                    <p className="mt-auto pt-5 text-xs text-ink-subtle">
                      {t("sectionsCount", { n: formatNumber(p.sections, locale) })}
                      {p.publishedAt && ` · ${t("publishedOn", { date: formatDate(p.publishedAt, locale) })}`}
                    </p>
                  </Link>
                </li>
              ))}
          </ul>

          <section aria-labelledby="seo-pages" className="mt-12">
            <h3 id="seo-pages" className="text-sm font-semibold">
              {t("seoOnlyTitle")}
            </h3>
            <p className="mt-1 text-sm text-ink-muted">{t("seoOnlyBody")}</p>
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {q.data
                .filter((p) => p.sections === 0)
                .map((p) => (
                  <li key={p.key}>
                    <Link href={`/dashboard/website/${p.key}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-surface-2">
                      <FileText aria-hidden className="size-4 shrink-0 text-ink-subtle" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{t(`pages.${p.key}`)}</span>
                        <span className="block font-mono text-xs text-ink-subtle">{PAGE_PATHS[p.key]}</span>
                      </span>
                      {status(p)}
                      <ArrowUpRight aria-hidden className="size-4 text-ink-subtle" />
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
