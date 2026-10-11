"use client";

import { Fragment, useState } from "react";
import { ChevronRight, ScrollText } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { apiRequest } from "@/lib/api/client";
import { errorMessage } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";

const AREAS = ["auth.", "user.", "org.", "media.", "system."];

/** Render a diff value compactly; objects (e.g. settings) as key: value pairs. */
function show(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return Object.entries(v).map(([k, x]) => `${k}: ${x}`).join(", ");
  return String(v);
}

function Row({ row, locale }) {
  const t = useTranslations("audit");
  const tr = useTranslations("roles");
  const [open, setOpen] = useState(false);
  const label = t.has(`actions.${row.action}`) ? t(`actions.${row.action}`) : row.action;
  const actor =
    row.actor?.kind === "system" ? t("system") : row.actor?.kind === "anonymous" ? t("anonymous") : (row.actor?.name ?? t("unknown"));
  const diff = row.diff ? Object.entries(row.diff) : [];
  const expandable = diff.length > 0 || row.meta;

  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        disabled={!expandable}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={expandable ? open : undefined}
        className="grid w-full grid-cols-[16px_1fr] items-start gap-3 px-4 py-3.5 text-left enabled:hover:bg-canvas md:grid-cols-[16px_170px_1fr_220px]"
      >
        <ChevronRight
          aria-hidden
          className={cn("mt-0.5 size-4 text-ink-subtle transition-transform", open && "rotate-90", !expandable && "invisible")}
        />
        <span className="hidden font-mono text-xs text-ink-muted md:block">{formatDate(row.createdAt, locale, "datetime")}</span>
        <span className="min-w-0">
          <span className="block text-sm font-medium">{label}</span>
          <span className="mt-0.5 block font-mono text-[11px] text-ink-subtle md:hidden">{formatDate(row.createdAt, locale, "datetime")}</span>
        </span>
        <span className="col-start-2 min-w-0 text-sm md:col-start-auto md:text-right">
          <span className="block truncate">{actor}</span>
          <span className="block text-[11px] text-ink-subtle">
            {row.actor?.role ? tr(row.actor.role) : ""}
            {row.ip ? ` · ${row.ip}` : ""}
          </span>
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 md:pl-[202px]">
          {diff.length > 0 && (
            <dl className="grid grid-cols-[minmax(90px,auto)_1fr] gap-x-4 gap-y-1.5 rounded-md border border-line bg-canvas p-3 text-xs">
              {diff.map(([field, d]) => (
                <Fragment key={field}>
                  <dt className="font-mono text-ink-muted">{field}</dt>
                  <dd className="min-w-0 break-words">
                    {d.changed ? (
                      <span className="text-ink-muted">{t("changedHidden")}</span>
                    ) : (
                      <>
                        <span className="text-danger line-through decoration-danger/40">{show(d.from)}</span>
                        <span className="mx-1.5 text-ink-subtle">→</span>
                        <span className="text-success">{show(d.to)}</span>
                      </>
                    )}
                  </dd>
                </Fragment>
              ))}
            </dl>
          )}
          {row.meta && (
            <p className="mt-2 font-mono text-[11px] break-all text-ink-subtle">
              {Object.entries(row.meta)
                .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`)
                .join("  ")}
            </p>
          )}
          {row.requestId && <p className="mt-1 font-mono text-[11px] text-ink-subtle">req {row.requestId}</p>}
        </div>
      )}
    </li>
  );
}

export function AuditPage() {
  const t = useTranslations("audit");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [area, setArea] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Dates are picked in Bangladesh time; send the day's bounds as Dhaka-local instants.
  const query = {
    limit: 30,
    action: area || undefined,
    from: from ? `${from}T00:00:00+06:00` : undefined,
    to: to ? `${to}T23:59:59.999+06:00` : undefined,
  };

  const feed = useInfiniteQuery({
    queryKey: ["audit", query],
    queryFn: ({ pageParam }) => apiRequest("/audit", { query: { ...query, cursor: pageParam } }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
  });

  const rows = feed.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />

      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_170px_170px]">
        <Field label={t("area")}>
          <Select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">{t("allAreas")}</option>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {t(`areas.${a.slice(0, -1)}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("from")}>
          <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={t("to")}>
          <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>

      {feed.isError ? (
        <ErrorState
          title={t("loadFailed")}
          description={errorMessage(te, feed.error)}
          requestId={feed.error?.requestId}
          requestIdLabel={tc("requestId")}
        />
      ) : feed.isPending ? (
        <Skeleton className="h-80 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={ScrollText} title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <>
          <ul className="overflow-hidden rounded-lg border border-line bg-surface">
            {rows.map((r) => (
              <Row key={r.id} row={r} locale={locale} />
            ))}
          </ul>
          {feed.hasNextPage && (
            <div className="mt-5 flex justify-center">
              <Button variant="secondary" loading={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
                {t("loadMore")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
