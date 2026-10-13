"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/** "● Live" while the socket room is joined; "Reconnecting…" otherwise. */
export function LiveBadge({ state, className }) {
  const t = useTranslations("site.live");
  const live = state === "live";
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium text-ink-muted", className)} aria-live="polite">
      <span aria-hidden className={cn("relative size-2 rounded-full", live ? "bg-status-available" : "bg-ink-subtle")}>
        {live && <span className="absolute inset-0 animate-ping rounded-full bg-status-available/60 motion-reduce:hidden" />}
      </span>
      {t(live ? "live" : state === "connecting" ? "connecting" : "offline")}
    </span>
  );
}

export function StatusLegend({ className }) {
  const t = useTranslations("site.status");
  const items = [
    ["available", "bg-status-available"],
    ["held", "bg-status-held"],
    ["sold", "bg-status-sold"],
  ];
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-muted", className)}>
      {items.map(([k, sw]) => (
        <li key={k} className="flex items-center gap-1.5">
          <span aria-hidden className={cn("size-2.5 rounded-[1px]", sw)} />
          {t(k)}
        </li>
      ))}
    </ul>
  );
}
