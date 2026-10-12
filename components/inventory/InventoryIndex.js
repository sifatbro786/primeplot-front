"use client";

import { ArrowRight, Grid3x3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { InventoryBar } from "@/components/projects/InventoryBar";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Link } from "@/i18n/navigation";
import { apiRequest } from "@/lib/api/client";
import { errorMessage, useSession } from "@/lib/auth/session";
import { keys } from "./queries";

/** /dashboard/units — jump straight into any project's live grid. */
export function InventoryIndex() {
  const t = useTranslations("inventory.index");
  const tp = useTranslations("projects");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const { can } = useSession();
  const query = { limit: 100, page: 1 };
  const list = useQuery({ queryKey: keys.projects(query), queryFn: () => apiRequest("/projects", { query }) });
  const rows = list.data?.data ?? [];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      {list.isError ? (
        <ErrorState title={tp("loadFailed")} description={errorMessage(te, list.error)} requestId={list.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : list.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Grid3x3}
          title={tp("emptyTitle")}
          description={tp("emptyBody")}
          action={
            can("projects:write") && (
              <Button as={Link} href="/dashboard/projects" size="sm">
                {tp("new")}
              </Button>
            )
          }
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {rows.map((p) => (
            <li key={p.id}>
              <Link href={`/dashboard/projects/${p.id}`} className="group grid gap-4 px-5 py-4 transition-colors hover:bg-canvas sm:grid-cols-[1fr_1.2fr_auto] sm:items-center">
                <span className="min-w-0">
                  <span className="block font-mono text-[10px] tracking-wide text-ink-subtle uppercase">{tp(`kinds.${p.kind}`)}</span>
                  <span className="block truncate text-sm font-medium">{locale === "bn" && p.nameBn ? p.nameBn : p.name}</span>
                </span>
                <InventoryBar inventory={p.inventory} />
                <ArrowRight aria-hidden className="hidden size-4 text-ink-subtle transition-transform group-hover:translate-x-0.5 sm:block" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
