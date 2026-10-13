"use client";

import { ArrowRightLeft, Ellipsis, MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Menu } from "@/components/ui/Menu";
import { cn } from "@/lib/cn";
import { STAGE_SWATCH, stageName } from "@/lib/crm/constants";
import { formatPhone } from "@/lib/format";
import { Avatar, FollowUp, SlaChip, SourceLabel, useNum } from "./parts";

/**
 * One Kanban card. Purely presentational: drag wiring lives in the board, which passes
 * `dragProps` (listeners/attributes) and `dragRef`. Every card also has a "Move to…" menu —
 * the keyboard/phone way to change stage (owner decision: phone = tabs + menu).
 */
export function LeadCard({ lead, stages, now, onOpen, onMove, dragging, overlay, dropBefore, dragRef, dragProps, className }) {
  const t = useTranslations("crm");
  const locale = useLocale();
  const num = useNum();
  const project = lead.interest?.project;
  const place = lead.type === "landowner" ? lead.land?.location : project ? (locale === "bn" && project.nameBn) || project.name : null;

  return (
    <div className={cn("relative", className)}>
      {dropBefore && <span aria-hidden className="absolute -top-1.5 right-1 left-1 h-0.5 rounded-full bg-accent" />}
      <article
        ref={dragRef}
        {...dragProps}
        onClick={() => onOpen?.(lead.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target === e.currentTarget) onOpen?.(lead.id);
        }}
        tabIndex={0}
        aria-label={t("openLead", { name: lead.name })}
        className={cn(
          "group relative cursor-pointer rounded-md border border-line bg-surface p-3 text-left outline-offset-2 transition-[box-shadow,border-color,opacity]",
          "hover:border-line-strong hover:shadow-[0_6px_18px_-12px_rgb(28_29_26_/_0.35)]",
          dragging && "opacity-35",
          overlay && "rotate-[1.5deg] cursor-grabbing border-line-strong shadow-[0_18px_36px_-18px_rgb(28_29_26_/_0.45)]",
        )}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm leading-snug font-medium">{lead.name}</p>
            <p className="mt-0.5 font-mono text-[11px] text-ink-muted">{formatPhone(lead.phone, locale)}</p>
          </div>
          {onMove && (
            <Menu
              label={t("moveTo")}
              trigger={(p) => (
                <button
                  type="button"
                  {...p}
                  aria-label={t("moveMenu", { name: lead.name })}
                  className="-mt-1 -mr-1.5 rounded-sm p-1 text-ink-subtle opacity-100 hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100 aria-expanded:opacity-100"
                >
                  <Ellipsis className="size-4" />
                </button>
              )}
              items={stages.map((s) => ({
                key: s.id,
                label: stageName(s, locale),
                current: s.id === lead.stageId,
                disabled: s.id === lead.stageId,
                icon: <span aria-hidden className={cn("size-2 rounded-[1px]", STAGE_SWATCH[s.color] ?? STAGE_SWATCH.neutral)} />,
                onSelect: () => onMove(lead, s),
              }))}
            />
          )}
        </div>

        {place && (
          <p className="mt-2 flex items-center gap-1 truncate text-xs text-ink-muted">
            {lead.type === "landowner" && <MapPin aria-hidden className="size-3 shrink-0" />}
            <span className="truncate">{place}</span>
          </p>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <SlaChip lead={lead} now={now} />
          {lead.enquiryCount > 1 && (
            <span className="inline-flex h-5 items-center rounded-sm border border-line px-1.5 text-[10px] font-medium text-ink-muted" title={t("enquiries")}>
              ×{num(lead.enquiryCount)}
            </span>
          )}
          {lead.tags?.slice(0, 2).map((tag) => (
            <span key={tag} className="inline-flex h-5 items-center rounded-sm bg-accent-soft px-1.5 text-[10px] font-medium text-accent">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-dashed border-line pt-2">
          <div className="flex min-w-0 items-center gap-2">
            <SourceLabel source={lead.source} compact />
            {lead.status === "open" ? (
              <FollowUp at={lead.nextFollowUpAt} now={now} className="truncate" />
            ) : (
              lead.lostReason && <span className="truncate text-[11px] text-ink-muted">{t(`lostReasons.${lead.lostReason}`)}</span>
            )}
          </div>
          {lead.assigneeName ? (
            <Avatar name={lead.assigneeName} size="sm" />
          ) : (
            <span className="text-[10px] font-semibold text-warning">{t("unassigned")}</span>
          )}
        </div>
      </article>
    </div>
  );
}

/** Compact "Move to" button for the drawer header etc. */
export function MoveIcon(props) {
  return <ArrowRightLeft aria-hidden className="size-3.5" {...props} />;
}
