"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format";
import { Button } from "./Button";

/** Offset pagination footer for admin tables: "21–40 of 57" + prev/next. */
export function Pagination({ meta, onPage }) {
  const t = useTranslations("common");
  const locale = useLocale();
  if (!meta || meta.total === 0) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);
  return (
    <div className="flex items-center justify-between gap-4 pt-4 text-xs text-ink-muted">
      <span>
        {t("range", { from: formatNumber(from, locale), to: formatNumber(to, locale), total: formatNumber(meta.total, locale) })}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label={t("prev")}>
          <ChevronLeft aria-hidden className="size-3.5" />
        </Button>
        <Button size="sm" variant="secondary" disabled={meta.page >= meta.pages} onClick={() => onPage(meta.page + 1)} aria-label={t("next")}>
          <ChevronRight aria-hidden className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
