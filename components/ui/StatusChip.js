"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { UNIT_STATUS_SWATCH as SWATCH } from "@/lib/unitStatus";

/**
 * Status is never colour alone: swatch + text label (text stays ink for contrast), and
 * `blocked` adds a hatch pattern.
 */
export function StatusChip({ status, size = "md", className }) {
  const t = useTranslations("unitStatus");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface font-medium text-ink",
        size === "sm" ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-[11px]",
        className,
      )}
    >
      <span aria-hidden className={cn("size-2 rounded-[1px]", SWATCH[status] ?? "bg-status-blocked")} />
      {t(status)}
    </span>
  );
}
