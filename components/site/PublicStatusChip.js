import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { PUBLIC_SWATCH } from "@/lib/public/status";

/** Swatch + label (never colour alone). Works in server and client trees. */
export function PublicStatusChip({ status, size = "md", className }) {
  const t = useTranslations("site.status");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface font-medium text-ink",
        size === "sm" ? "h-5 px-1.5 text-[10px]" : "h-6 px-2 text-[11px]",
        className,
      )}
    >
      <span aria-hidden className={cn("size-2 rounded-[1px]", PUBLIC_SWATCH[status] ?? PUBLIC_SWATCH.unavailable)} />
      {t(status in PUBLIC_SWATCH ? status : "unavailable")}
    </span>
  );
}
