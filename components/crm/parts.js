"use client";

import { useEffect, useState } from "react";
import { Camera, Clock, Globe, Megaphone, MessageCircle, Phone, Store, UserPlus, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { initials } from "@/components/shell/UserMenu";
import { cn } from "@/lib/cn";
import { minutesLabel, slaState, STAGE_SWATCH, stageName } from "@/lib/crm/constants";
import { formatDate } from "@/lib/format";

/** Current time, re-rendered every `ms` (SLA countdowns). */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

const SLA_TONE = {
  ok: "border-line bg-surface-2 text-ink-muted",
  soon: "border-warning/40 bg-warning-bg text-warning",
  late: "border-danger/40 bg-danger-bg text-danger",
};

/** First-response countdown. Text + tone (never colour alone). */
export function SlaChip({ lead, now, className }) {
  const t = useTranslations("crm.sla");
  const num = useNum();
  const s = slaState(lead, now);
  if (!s.state || s.state === "done") return null;
  return (
    <span
      className={cn("inline-flex h-5 items-center gap-1 rounded-sm border px-1.5 text-[10px] font-semibold whitespace-nowrap", SLA_TONE[s.state], className)}
      title={t("title")}
    >
      <Clock aria-hidden className="size-3" />
      {s.state === "late" ? t("late", { time: minutesLabel(s.minutes, t, num) }) : t("left", { time: minutesLabel(s.minutes, t, num) })}
    </span>
  );
}

export function StageBadge({ stage, className }) {
  const locale = useLocale();
  if (!stage) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm whitespace-nowrap", className)}>
      <span aria-hidden className={cn("size-2 rounded-[1px]", STAGE_SWATCH[stage.color] ?? STAGE_SWATCH.neutral)} />
      {stageName(stage, locale)}
    </span>
  );
}

const SOURCE_ICON = {
  website: Globe,
  facebook: Megaphone,
  instagram: Camera,
  manual: UserPlus,
  walk_in: Store,
  phone: Phone,
  referral: Users,
  other: MessageCircle,
};

export function SourceLabel({ source, compact = false, className }) {
  const t = useTranslations("crm.sources");
  const Icon = SOURCE_ICON[source] ?? MessageCircle;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-ink-muted", className)} title={t(source)}>
      <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={1.6} />
      {compact ? <span className="sr-only">{t(source)}</span> : <span className="truncate">{t(source)}</span>}
    </span>
  );
}

export function Avatar({ name, size = "md", className }) {
  return (
    <span
      title={name}
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-surface-3 font-semibold text-ink-muted",
        size === "sm" ? "size-6 text-[9px]" : "size-8 text-[11px]",
        className,
      )}
    >
      {initials(name ?? "")}
    </span>
  );
}

/** Owner: avatar + name, or an "Unassigned" marker. */
export function Owner({ name, className }) {
  const t = useTranslations("crm");
  if (!name)
    return <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-warning", className)}>{t("unassigned")}</span>;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <Avatar name={name} size="sm" />
      <span className="truncate text-sm">{name}</span>
    </span>
  );
}

/** "Follow-up: today 4:30 pm" with an overdue tone. */
export function FollowUp({ at, now, className }) {
  const t = useTranslations("crm");
  const locale = useLocale();
  if (!at) return null;
  const overdue = new Date(at).getTime() < now;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] whitespace-nowrap", overdue ? "font-semibold text-danger" : "text-ink-muted", className)}>
      {overdue ? t("followUpOverdue") : t("followUpAt")} {formatDate(at, locale, "datetime")}
    </span>
  );
}

/** Bangla digits in bn for small counts. */
export function useNum() {
  const locale = useLocale();
  return (n) => new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-IN").format(n ?? 0);
}
