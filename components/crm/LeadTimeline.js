"use client";

import { useState } from "react";
import {
  AlarmClock,
  ArrowRightLeft,
  Bot,
  CalendarCheck,
  CircleCheck,
  CirclePlus,
  Footprints,
  Mail,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  Pencil,
  Phone,
  Repeat,
  StickyNote,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { CALL_OUTCOMES, fromDhakaInput, stageName, USER_ACTIVITY_TYPES } from "@/lib/crm/constants";
import { useCrmError } from "@/lib/crm/errors";
import { crmKeys, flatPages, useActivities, useCrmRefresh } from "@/lib/crm/queries";
import { formatDate } from "@/lib/format";
import { useQueryClient } from "@tanstack/react-query";
import { useNum } from "./parts";

const ICONS = {
  note: StickyNote,
  call: Phone,
  sms: MessageSquareText,
  email: Mail,
  whatsapp: MessageCircle,
  meeting: Users,
  site_visit: Footprints,
  created: CirclePlus,
  enquiry: Repeat,
  stage_change: ArrowRightLeft,
  assigned: UserRoundCheck,
  merged: Users,
  task_created: CalendarCheck,
  task_done: CircleCheck,
  updated: Pencil,
  auto_reply: Bot,
  sla_escalated: AlarmClock,
  meta_lead: Megaphone,
};

/**
 * Log a contact or a note. `preset` = { type, nonce } from the header buttons (Call / WhatsApp):
 * the composer switches to that type so the outcome is one tap away.
 */
export function Composer({ lead, preset }) {
  const t = useTranslations("crm.composer");
  const ta = useTranslations("crm.activityTypes");
  const to = useTranslations("crm.callOutcomes");
  const crmError = useCrmError();
  const refresh = useCrmRefresh();
  const qc = useQueryClient();
  const [type, setType] = useState(preset?.type ?? "note");
  const [body, setBody] = useState("");
  const [outcome, setOutcome] = useState("");
  const [minutes, setMinutes] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  const [seen, setSeen] = useState(preset?.nonce);
  if (preset?.nonce !== seen) {
    // A header button was pressed again — follow it.
    setSeen(preset?.nonce);
    setType(preset?.type ?? "note");
  }

  const canSend = type === "note" ? body.trim().length > 0 : true;
  const submit = async (e) => {
    e.preventDefault();
    if (!canSend) return;
    setBusy(true);
    try {
      await api.post(`/leads/${lead.id}/activities`, {
        type,
        ...(body.trim() && { body: body.trim() }),
        ...(type === "call" && outcome && { outcome }),
        ...(type === "call" && minutes && { durationSec: Math.round(Number(minutes) * 60) }),
        ...(when && { at: fromDhakaInput(when) }),
      });
      setBody("");
      setOutcome("");
      setMinutes("");
      setWhen("");
      toast.success(t("logged"));
      qc.invalidateQueries({ queryKey: crmKeys.activities(lead.id) });
      refresh(lead.id);
    } catch (err) {
      toast.error(crmError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-lg border border-line bg-surface-2/50 p-3">
      <div role="radiogroup" aria-label={t("type")} className="mb-3 flex flex-wrap gap-1">
        {USER_ACTIVITY_TYPES.map((x) => {
          const Icon = ICONS[x];
          return (
            <button
              key={x}
              type="button"
              role="radio"
              aria-checked={type === x}
              onClick={() => setType(x)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-sm border px-2 text-xs font-medium",
                type === x ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink-muted hover:text-ink",
              )}
            >
              <Icon aria-hidden className="size-3.5" />
              {ta(x)}
            </button>
          );
        })}
      </div>
      {type === "call" && (
        <div className="mb-3">
          <p className="mb-1.5 text-xs font-medium">{t("outcome")}</p>
          <div className="flex flex-wrap gap-1.5">
            {CALL_OUTCOMES.map((o) => (
              <button
                key={o}
                type="button"
                aria-pressed={outcome === o}
                onClick={() => setOutcome(outcome === o ? "" : o)}
                className={cn(
                  "h-7 rounded-full border px-2.5 text-xs",
                  outcome === o ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line bg-surface text-ink-muted hover:text-ink",
                )}
              >
                {to(o)}
              </button>
            ))}
          </div>
        </div>
      )}
      <Textarea
        rows={2}
        maxLength={4000}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={type === "note" ? t("notePlaceholder") : t("bodyPlaceholder")}
        aria-label={t("body")}
      />
      <div className="mt-2.5 flex flex-wrap items-end gap-2.5">
        {type === "call" && (
          <Field label={t("minutes")} className="w-24">
            <Input inputMode="decimal" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/[^\d.]/g, ""))} />
          </Field>
        )}
        {type !== "note" && (
          <Field label={t("when")} hint={t("whenHint")} className="w-52">
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
        )}
        <div className="flex-1" />
        <Button type="submit" size="sm" loading={busy} disabled={!canSend}>
          {type === "note" ? t("addNote") : t("log")}
        </Button>
      </div>
    </form>
  );
}

function describe(a, { t, locale, stages, num }) {
  const actor = a.actorName ?? t("system");
  const m = a.meta ?? {};
  const st = (id) => stageName(stages?.find((s) => s.id === id), locale) || "—";
  switch (a.type) {
    case "call":
      return t("call", { actor }) + (a.outcome ? ` · ${t(`outcome.${a.outcome}`)}` : "");
    case "note":
    case "sms":
    case "email":
    case "whatsapp":
    case "meeting":
    case "site_visit":
      return t(a.type, { actor });
    case "created":
      return a.actorName ? t("createdBy", { actor }) : t("created", { source: t(`source.${m.source ?? "other"}`) });
    case "enquiry":
      return t("enquiry", { source: t(`source.${m.source ?? "other"}`) });
    case "stage_change":
      return t("stageChange", { actor, from: st(m.from), to: st(m.to) }) + (m.lostReason ? ` · ${t(`lost.${m.lostReason}`)}` : "");
    case "assigned":
      return m.to ? t(m.auto ? "assignedAuto" : "assigned", { to: m.toName ?? "—", actor }) : t("unassigned", { actor });
    case "merged":
      return t("merged", { name: m.sourceName ?? "—" });
    case "task_created":
      return t("taskCreated", { actor });
    case "task_done":
      return t("taskDone", { actor });
    case "updated":
      return t("updated", { actor, fields: (m.fields ?? []).map((f) => t(`field.${f}`)).join(", ") });
    case "auto_reply":
      return t(`autoReply.${m.status ?? "sent"}`, { n: num(m.segments ?? 1) });
    case "sla_escalated":
      return t("slaEscalated", { n: num(m.notified ?? 0) });
    case "meta_lead":
      return t("metaLead", { form: m.formName ?? m.formId ?? "—" });
    default:
      return a.type;
  }
}

/** Lead timeline, newest first, with a "load older" button. */
export function Timeline({ leadId, stages }) {
  const t = useTranslations("crm.timeline");
  const locale = useLocale();
  const num = useNum();
  const q = useActivities(leadId);
  const items = flatPages(q.data);

  if (q.isPending) return <Skeleton className="h-40 w-full" />;
  if (!items.length) return <p className="py-6 text-center text-sm text-ink-muted">{t("empty")}</p>;

  return (
    <div>
      <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[13px] before:w-px before:bg-line">
        {items.map((a) => {
          const Icon = ICONS[a.type] ?? StickyNote;
          const system = !USER_ACTIVITY_TYPES.includes(a.type);
          const m = a.meta ?? {};
          return (
            <li key={a.id} className="relative flex gap-3">
              <span
                className={cn(
                  "relative z-[1] grid size-7 shrink-0 place-items-center rounded-full border",
                  system ? "border-line bg-surface text-ink-subtle" : "border-accent/40 bg-accent-soft text-accent",
                  a.type === "sla_escalated" && "border-danger/40 bg-danger-bg text-danger",
                )}
              >
                <Icon aria-hidden className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm leading-snug">{describe(a, { t, locale, stages, num })}</p>
                <p className="mt-0.5 text-[11px] text-ink-subtle">
                  {formatDate(a.at, locale, "datetime")}
                  {a.durationSec ? ` · ${t("duration", { m: num(Math.max(1, Math.round(a.durationSec / 60))) })}` : ""}
                </p>
                {a.body && (
                  <p className={cn("mt-1.5 rounded-md bg-surface-2 px-3 py-2 text-sm whitespace-pre-line", a.type === "auto_reply" && "font-mono text-xs")}>
                    {a.body}
                  </p>
                )}
                {a.type === "meta_lead" && (m.adName || m.campaign) && (
                  <p className="mt-1 text-xs text-ink-muted">{[m.campaign, m.adName].filter(Boolean).join(" · ")}</p>
                )}
                {a.type === "enquiry" && m.page && <p className="mt-1 truncate font-mono text-[11px] text-ink-subtle">{m.page}</p>}
                {a.type === "auto_reply" && m.errorCode && <p className="mt-1 text-xs text-danger">{t.has(`smsError.${m.errorCode}`) ? t(`smsError.${m.errorCode}`) : m.errorCode}</p>}
              </div>
            </li>
          );
        })}
      </ol>
      {q.hasNextPage && (
        <div className="mt-4 text-center">
          <Button size="sm" variant="ghost" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
            {t("older")}
          </Button>
        </div>
      )}
    </div>
  );
}
