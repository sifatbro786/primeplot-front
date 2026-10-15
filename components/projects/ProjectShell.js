"use client";

import { ArrowLeft, Building2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Tag } from "@/components/ui/Tag";
import { Link, usePathname } from "@/i18n/navigation";
import { errorMessage } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { useProject } from "@/components/inventory/queries";
import { StageTag } from "./StageTag";

const TABS = [
  { key: "inventory", path: "" },
  { key: "details", path: "/details" },
  { key: "plans", path: "/plans" },
  { key: "pricing", path: "/pricing" },
  { key: "prices", path: "/prices" },
  { key: "gallery", path: "/gallery" },
  { key: "construction", path: "/construction" },
  { key: "sales", path: "/sales" },
  { key: "seo", path: "/seo" },
];

/** Project workspace frame: title + tabs. Children render the active tab. */
export function ProjectShell({ children }) {
  const { id } = useParams();
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const pathname = usePathname();
  const project = useProject(id);
  const base = `/dashboard/projects/${id}`;

  if (project.isError) {
    return project.error?.status === 404 ? (
      <EmptyState
        icon={Building2}
        title={t("notFound")}
        action={
          <Button as={Link} href="/dashboard/projects" size="sm" variant="secondary">
            {t("back")}
          </Button>
        }
        className="mx-auto max-w-2xl"
      />
    ) : (
      <ErrorState
        title={t("loadFailed")}
        description={errorMessage(te, project.error)}
        requestId={project.error?.requestId}
        requestIdLabel={tc("requestId")}
        className="mx-auto max-w-2xl"
      />
    );
  }

  const p = project.data;
  const name = p && (locale === "bn" && p.nameBn ? p.nameBn : p.name);

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/dashboard/projects" className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-3.5" />
        {t("back")}
      </Link>
      <header className="mt-4 mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        {p ? (
          <div className="min-w-0">
            <span className="eyebrow">{t(`kinds.${p.kind}`)}</span>
            <h2 className="mt-3 truncate font-display text-4xl leading-tight">{name}</h2>
            <p className="mt-2 font-mono text-xs text-ink-subtle">/{p.slug}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-10 w-80" />
          </div>
        )}
        {p && (
          <div className="flex shrink-0 gap-1.5">
            <StageTag stage={p.stage} />
            {p.published ? <Tag tone="accent">{t("published")}</Tag> : <Tag tone="outline">{t("draft")}</Tag>}
          </div>
        )}
      </header>

      <nav aria-label={t("tabsLabel")} className="mb-8 flex gap-6 scroll-x border-b border-line">
        {TABS.map((tab) => {
          const href = `${base}${tab.path}`;
          const active = tab.path ? pathname.startsWith(href) : pathname === href;
          return (
            <Link
              key={tab.key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 pb-3 text-sm font-medium whitespace-nowrap transition-colors",
                active ? "border-primary text-ink" : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {t(`tabs.${tab.key}`)}
            </Link>
          );
        })}
      </nav>

      {/* Always render the tab: it waits for the same cached query itself (keeps the segment in
          the prerendered shell for instant navigation). */}
      {children}
    </div>
  );
}
