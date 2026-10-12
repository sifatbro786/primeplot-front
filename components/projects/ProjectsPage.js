"use client";

import { useState } from "react";
import { Building2, MapPin, Plus, Search } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { SmartImage } from "@/components/media/SmartImage";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Tag } from "@/components/ui/Tag";
import { Link } from "@/i18n/navigation";
import { apiRequest } from "@/lib/api/client";
import { errorMessage, useSession } from "@/lib/auth/session";
import { formatBDTCompact, formatLand, formatNumber } from "@/lib/format";
import { useDebounced } from "@/lib/hooks/useDebounced";
import { keys } from "@/components/inventory/queries";
import { InventoryBar } from "./InventoryBar";
import { ProjectCreateDrawer } from "./ProjectCreateDrawer";
import { STAGES, StageTag } from "./StageTag";

function ProjectRow({ p }) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const name = locale === "bn" && p.nameBn ? p.nameBn : p.name;
  const area = [locale === "bn" ? (p.location?.areaBn ?? p.location?.area) : p.location?.area, p.location?.city].filter(Boolean).join(", ");
  const inv = p.inventory ?? { total: 0, byStatus: {} };
  return (
    <li>
      <Link
        href={`/dashboard/projects/${p.id}`}
        className="group grid gap-0 overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-line-strong sm:grid-cols-[220px_1fr]"
      >
        <SmartImage
          media={p.media?.cover}
          variant="card"
          category={p.kind === "plot" ? "plot-land" : "apartment-exterior"}
          seed={p.id}
          sampleBadge
          sizes="220px"
          className="aspect-[16/10] sm:aspect-auto sm:h-full"
        />
        <div className="flex min-w-0 flex-col gap-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[11px] tracking-wide text-ink-subtle uppercase">{t(`kinds.${p.kind}`)}</p>
              <h3 className="mt-1 truncate font-display text-2xl leading-tight group-hover:underline group-hover:underline-offset-4">{name}</h3>
              {area && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                  <MapPin aria-hidden className="size-3.5" />
                  {area}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-1.5">
              <StageTag stage={p.stage} />
              {p.published ? <Tag tone="accent">{t("published")}</Tag> : <Tag tone="outline">{t("draft")}</Tag>}
            </div>
          </div>
          <div className="mt-auto grid gap-4 border-t border-line pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <InventoryBar inventory={inv} />
            <dl className="flex gap-6 text-right text-xs">
              {p.landArea && (
                <div>
                  <dt className="text-ink-subtle">{t("landArea")}</dt>
                  <dd className="mt-0.5 font-medium text-ink">{formatLand(p.landArea, locale)}</dd>
                </div>
              )}
              <div>
                <dt className="text-ink-subtle">{t("from")}</dt>
                <dd className="mt-0.5 font-mono font-medium text-ink">{inv.availableFrom ? formatBDTCompact(inv.availableFrom, locale) : "—"}</dd>
              </div>
              <div>
                <dt className="text-ink-subtle">{t("units")}</dt>
                <dd className="mt-0.5 font-mono font-medium text-ink">{formatNumber(inv.total, locale)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </Link>
    </li>
  );
}

export function ProjectsPage() {
  const t = useTranslations("projects");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const { can } = useSession();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [stage, setStage] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const search = useDebounced(q.trim());

  const query = { q: search || undefined, kind: kind || undefined, stage: stage || undefined, page, limit: 20 };
  const list = useQuery({
    queryKey: keys.projects(query),
    queryFn: () => apiRequest("/projects", { query }),
    placeholderData: keepPreviousData,
  });
  const rows = list.data?.data ?? [];
  const filtered = Boolean(search || kind || stage);
  const reset = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          can("projects:write") && (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden className="size-4" />
              {t("new")}
            </Button>
          )
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_180px_180px]">
        <Input
          leading={<Search className="size-4" />}
          placeholder={t("search")}
          aria-label={t("search")}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <Select value={kind} onChange={reset(setKind)} aria-label={t("kind")}>
          <option value="">{t("allKinds")}</option>
          <option value="apartment">{t("kinds.apartment")}</option>
          <option value="plot">{t("kinds.plot")}</option>
        </Select>
        <Select value={stage} onChange={reset(setStage)} aria-label={t("stage")}>
          <option value="">{t("allStages")}</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {t(`stages.${s}`)}
            </option>
          ))}
        </Select>
      </div>

      {list.isError ? (
        <ErrorState
          title={t("loadFailed")}
          description={errorMessage(te, list.error)}
          requestId={list.error?.requestId}
          requestIdLabel={tc("requestId")}
          action={
            <Button size="sm" variant="secondary" onClick={() => list.refetch()}>
              {tc("retry")}
            </Button>
          }
        />
      ) : list.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={filtered ? t("noMatches") : t("emptyTitle")}
          description={filtered ? t("noMatchesBody") : t("emptyBody")}
          action={
            !filtered &&
            can("projects:write") && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus aria-hidden className="size-4" />
                {t("new")}
              </Button>
            )
          }
        />
      ) : (
        <>
          <ul className="space-y-3" aria-busy={list.isFetching || undefined}>
            {rows.map((p) => (
              <ProjectRow key={p.id} p={p} />
            ))}
          </ul>
          <Pagination meta={list.data?.meta} onPage={setPage} />
        </>
      )}

      {can("projects:write") && <ProjectCreateDrawer open={creating} onClose={() => setCreating(false)} />}
    </div>
  );
}
