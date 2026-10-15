"use client";

import { useState } from "react";
import { BellRing, Mail, MessageSquare, Plus, Send, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useDate, useDay, useMoney } from "@/components/sales/parts";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { toast } from "@/components/ui/Toast";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { reminderKeys, useReminderLog, useReminderPreview } from "@/lib/review/queries";
import { salesKeys, useAccountSettings } from "@/lib/sales/queries";
import { useSearchState } from "@/lib/sales/url";
import { useReviewError } from "./parts";

const TABS = ["today", "log", "rules"];
const MAX_RULES = 8;

/** offsetDays → stable rule key (the API's dedupe key: one message per booking/rule/due date). */
export const ruleKeyOf = (d) => (d < 0 ? `before_${-d}` : d === 0 ? "due_day" : `overdue_${d}`);
const offsetOfKey = (key) => {
  const m = /^(before|overdue)_(\d+)$/.exec(key ?? "");
  if (m) return m[1] === "before" ? -Number(m[2]) : Number(m[2]);
  return key === "due_day" ? 0 : null;
};

/** "7 days before" / "On the due date" / "3 days after" / "Sent by hand". */
export function useRuleLabel() {
  const t = useTranslations("review.reminders.rule");
  const locale = useLocale();
  return (keyOrOffset) => {
    if (keyOrOffset === "manual") return t("manual");
    const d = typeof keyOrOffset === "number" ? keyOrOffset : offsetOfKey(keyOrOffset);
    if (d == null) return String(keyOrOffset);
    const n = formatNumber(Math.abs(d), locale);
    return d < 0 ? t("before", { n }) : d === 0 ? t("onDay") : t("after", { n });
  };
}

/** /dashboard/reminders — today's reminders, the delivery log and the rules (F6.3). */
export function RemindersPage() {
  const t = useTranslations("review.reminders");
  const { can } = useSession();
  const [params, write] = useSearchState();
  const manage = can("reminders:manage");
  const tabs = TABS.filter((k) => k !== "today" || manage);
  const tab = tabs.includes(params.get("tab")) ? params.get("tab") : tabs[0];
  const settings = useAccountSettings();
  const r = settings.data?.reminders;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      {r && (
        <p className={cn("mb-6 flex items-center gap-2 text-sm", r.enabled ? "text-ink-muted" : "text-warning")}>
          <BellRing aria-hidden className="size-4" />
          {r.enabled ? t("status.on", { hour: hourLabel(r.sendHour) }) : t("status.off")}
        </p>
      )}
      <nav aria-label={t("tabsLabel")} className="mb-8 flex gap-6 scroll-x border-b border-line">
        {tabs.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => write({ tab: k === tabs[0] ? null : k })}
            aria-current={tab === k ? "page" : undefined}
            className={cn("-mb-px border-b-2 pb-3 text-sm font-medium whitespace-nowrap transition-colors", tab === k ? "border-primary text-ink" : "border-transparent text-ink-muted hover:text-ink")}
          >
            {t(`tabs.${k}`)}
          </button>
        ))}
      </nav>
      {tab === "today" && <Today />}
      {tab === "log" && <Log rules={r?.rules ?? []} />}
      {tab === "rules" && <Rules settings={settings} />}
    </div>
  );
}

const hourLabel = (h) => `${String(h).padStart(2, "0")}:00`;

function Channels({ sms, email }) {
  const t = useTranslations("review.reminders");
  if (!sms && !email) return <span className="text-xs text-warning">{t("noChannel")}</span>;
  return (
    <span className="inline-flex gap-1.5">
      {sms && (
        <Tag tone="outline" className="gap-1">
          <MessageSquare aria-hidden className="size-3" />
          SMS
        </Tag>
      )}
      {email && (
        <Tag tone="outline" className="gap-1">
          <Mail aria-hidden className="size-3" />
          {t("email")}
        </Tag>
      )}
    </span>
  );
}

const KIND_TONE = { upcoming: "info", today: "warning", overdue: "danger" };

function Today() {
  const t = useTranslations("review.reminders");
  const locale = useLocale();
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const money = useMoney();
  const day = useDay();
  const label = useRuleLabel();
  const reviewError = useReviewError();
  const preview = useReminderPreview();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  if (preview.isError) return <ErrorState title={t("loadFailed")} description={reviewError(preview.error)} requestId={preview.error?.requestId} requestIdLabel={tc("requestId")} />;
  if (preview.isPending) return <Skeleton className="h-64 w-full" />;
  const p = preview.data;
  const items = p.items ?? [];
  const silent = items.filter((i) => !i.channels.sms && !i.channels.email).length;

  const run = async () => {
    setBusy(true);
    try {
      const r = await api.post("/reminders/run");
      if (r.skipped === "disabled") toast(t("run.disabled"));
      else toast.success(t("run.done", { sent: formatNumber(r.sent ?? 0, locale), already: formatNumber(r.alreadySent ?? 0, locale) }));
      qc.invalidateQueries({ queryKey: ["reminders"] });
      setConfirm(false);
    } catch (err) {
      toast.error(reviewError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <dl className="flex flex-wrap gap-x-10 gap-y-3">
          <Stat label={t("today.date")} value={day(p.today)} />
          <Stat label={t("today.toSend")} value={items.length} mono />
          <Stat label={t("today.already")} value={p.alreadySent ?? 0} mono />
          {silent > 0 && <Stat label={t("today.silent")} value={silent} mono warn />}
        </dl>
        <Button onClick={() => setConfirm(true)} disabled={!items.length}>
          <Send aria-hidden className="size-4" />
          {t("run.button")}
        </Button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={BellRing} title={t("today.emptyTitle")} description={t("today.emptyBody")} />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>{t("cols.customer")}</TH>
              <TH className="hidden md:table-cell">{t("cols.rule")}</TH>
              <TH className="hidden sm:table-cell">{t("cols.due")}</TH>
              <TH align="right">{t("cols.amount")}</TH>
              <TH>{t("cols.channels")}</TH>
            </tr>
          </THead>
          <TBody>
            {items.map((i) => (
              <TR key={`${i.bookingId}:${i.rule}:${i.dueDate}`}>
                <TD>
                  <span className="text-sm font-medium">{i.customer?.name ?? "—"}</span>
                  <Link href={`/dashboard/bookings/${i.bookingId}`} className="block font-mono text-[11px] text-ink-subtle hover:underline">
                    {i.bookingNo} · {i.unitCode}
                  </Link>
                </TD>
                <TD className="hidden md:table-cell">
                  <Tag tone={KIND_TONE[i.kind] ?? "neutral"}>{label(i.rule)}</Tag>
                </TD>
                <TD className="hidden text-sm whitespace-nowrap sm:table-cell">{day(i.dueDate)}</TD>
                <TD numeric>{money(i.amount)}</TD>
                <TD>
                  <Channels sms={i.channels.sms} email={i.channels.email} />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <Dialog
        open={confirm}
        onClose={busy ? undefined : () => setConfirm(false)}
        title={t("run.title")}
        description={t("run.body", { n: formatNumber(items.length, locale) })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button onClick={run} loading={busy}>
              {t("run.confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">{t("run.note")}</p>
      </Dialog>
    </section>
  );
}

function Stat({ label, value, mono, warn }) {
  const locale = useLocale();
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-ink-subtle uppercase">{label}</dt>
      <dd className={cn("mt-1 text-lg", mono && "font-mono tabular-nums", warn && "text-warning")}>{typeof value === "number" ? formatNumber(value, locale) : value}</dd>
    </div>
  );
}

const DELIVERY_TONE = { queued: "success", skipped: "warning", off: "neutral" };

function Delivery({ c, kind }) {
  const t = useTranslations("review.reminders.delivery");
  const Icon = kind === "sms" ? MessageSquare : Mail;
  const status = c?.status ?? "off";
  return (
    <span className="inline-flex items-center gap-1.5" title={c?.reason ?? undefined}>
      <Icon aria-hidden className="size-3.5 text-ink-subtle" />
      <Tag tone={DELIVERY_TONE[status] ?? "neutral"}>{t(status)}</Tag>
    </span>
  );
}

function Log({ rules }) {
  const t = useTranslations("review.reminders");
  const tc = useTranslations("common");
  const money = useMoney();
  const day = useDay();
  const date = useDate();
  const label = useRuleLabel();
  const reviewError = useReviewError();
  const [params, write] = useSearchState();
  const query = { rule: params.get("rule") || undefined, from: params.get("from") || undefined, to: params.get("to") || undefined, bookingId: params.get("bookingId") || undefined };
  const list = useReminderLog(query);
  const rows = list.data?.pages.flatMap((p) => p.data ?? []) ?? [];
  const ruleKeys = [...new Set([...rules.map((r) => r.key), "manual"])];

  return (
    <section>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Select value={params.get("rule") ?? ""} onChange={(e) => write({ rule: e.target.value || null })} aria-label={t("log.rule")}>
          <option value="">{t("log.allRules")}</option>
          {ruleKeys.map((k) => (
            <option key={k} value={k}>
              {label(k)}
            </option>
          ))}
        </Select>
        <Input type="date" value={params.get("from") ?? ""} onChange={(e) => write({ from: e.target.value || null })} aria-label={t("log.from")} title={t("log.from")} />
        <Input type="date" value={params.get("to") ?? ""} onChange={(e) => write({ to: e.target.value || null })} aria-label={t("log.to")} title={t("log.to")} />
      </div>
      {list.isError ? (
        <ErrorState title={t("loadFailed")} description={reviewError(list.error)} requestId={list.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : list.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState icon={BellRing} title={t("log.empty")} />
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <TH>{t("cols.sent")}</TH>
                <TH>{t("cols.customer")}</TH>
                <TH className="hidden md:table-cell">{t("cols.rule")}</TH>
                <TH align="right">{t("cols.amount")}</TH>
                <TH>{t("cols.delivery")}</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="text-sm whitespace-nowrap">
                    {date(r.createdAt, "datetime")}
                    {r.by?.name && <span className="block text-[11px] text-ink-subtle">{t("log.by", { name: r.by.name })}</span>}
                  </TD>
                  <TD>
                    <span className="text-sm font-medium">{r.customer?.name ?? "—"}</span>
                    <Link href={`/dashboard/bookings/${r.bookingId}`} className="block font-mono text-[11px] text-ink-subtle hover:underline">
                      {r.bookingNo} · {r.unitCode}
                    </Link>
                  </TD>
                  <TD className="hidden md:table-cell">
                    <span className="text-sm">{label(r.rule)}</span>
                    <span className="block text-[11px] text-ink-subtle">{t("log.due", { date: day(r.dueDate) })}</span>
                  </TD>
                  <TD numeric>
                    {money(r.amount)}
                    {r.totalOverdue > 0 && r.totalOverdue !== r.amount && <span className="block text-[11px] text-danger">{t("log.overdue", { amount: money(r.totalOverdue) })}</span>}
                  </TD>
                  <TD>
                    <div className="flex flex-col gap-1">
                      <Delivery c={r.sms} kind="sms" />
                      <Delivery c={r.email} kind="email" />
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
          {list.hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" size="sm" loading={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
                {t("loadMore")}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Rules({ settings }) {
  const t = useTranslations("review.reminders");
  const tc = useTranslations("common");
  const reviewError = useReviewError();
  if (settings.isError) return <ErrorState title={t("loadFailed")} description={reviewError(settings.error)} requestId={settings.error?.requestId} requestIdLabel={tc("requestId")} />;
  if (settings.isPending) return <Skeleton className="h-80 w-full" />;
  return <RulesForm key={settings.data.version} s={settings.data} />;
}

const toRows = (rules) => [...rules].sort((a, b) => a.offsetDays - b.offsetDays).map((r) => ({ ...r, days: String(Math.abs(r.offsetDays)), when: r.offsetDays < 0 ? "before" : r.offsetDays === 0 ? "on" : "after" }));
const offsetOf = (row) => (row.when === "on" ? 0 : (row.when === "before" ? -1 : 1) * Number(row.days));

function RulesForm({ s }) {
  const t = useTranslations("review.reminders");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const reviewError = useReviewError();
  const { can } = useSession();
  const editable = can("reminders:manage", "accounts:settings");
  const initial = { enabled: s.reminders.enabled, sendHour: s.reminders.sendHour, rows: toRows(s.reminders.rules) };
  const [f, setF] = useState(initial);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const setRow = (i, patch) => setF((o) => ({ ...o, rows: o.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  const check = () => {
    for (const r of f.rows) {
      if (r.when !== "on" && !/^\d{1,3}$/.test(r.days.trim())) return t("rules.badDays");
      const d = offsetOf(r);
      if (d < -60 || d > 120) return t("rules.range");
      if (d === 0 && r.when !== "on") return t("rules.badDays");
    }
    const offs = f.rows.map(offsetOf);
    if (new Set(offs).size !== offs.length) return t("rules.duplicate");
    return null;
  };

  const save = async (e) => {
    e.preventDefault();
    const problem = check();
    if (problem) return setError(problem);
    setError(null);
    setBusy(true);
    try {
      const rules = f.rows.map((r) => ({ key: ruleKeyOf(offsetOf(r)), offsetDays: offsetOf(r), enabled: r.enabled, sms: r.sms, email: r.email })).sort((a, b) => a.offsetDays - b.offsetDays);
      const saved = await api.patch("/accounts/settings", { version: s.version, reminders: { enabled: f.enabled, sendHour: Number(f.sendHour), rules } });
      qc.setQueryData(salesKeys.settings, saved);
      qc.invalidateQueries({ queryKey: reminderKeys.preview });
      toast.success(t("rules.saved"));
    } catch (err) {
      if (err?.code === "STALE_VERSION") qc.invalidateQueries({ queryKey: salesKeys.settings });
      setError(reviewError(err));
    } finally {
      setBusy(false);
    }
  };

  const add = () => {
    const used = new Set(f.rows.map(offsetOf));
    const next = [30, 7, 1, 45, 60, 10, 5].find((d) => !used.has(d)) ?? 2;
    setF((o) => ({ ...o, rows: [...o.rows, { key: ruleKeyOf(next), offsetDays: next, enabled: true, sms: true, email: true, days: String(next), when: "after" }] }));
  };

  return (
    <form onSubmit={save} noValidate className="space-y-8">
      <FormAlert>{error}</FormAlert>
      {!editable && <p className="rounded-md bg-surface-2 px-4 py-3 text-sm text-ink-muted">{t("rules.readOnly")}</p>}
      <fieldset disabled={!editable || busy} className="space-y-8">
        <RuleTimeline rows={f.rows} />

        <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
          <Checkbox label={t("rules.enabled")} description={t("rules.enabledHint")} checked={f.enabled} onChange={(e) => setF((o) => ({ ...o, enabled: e.target.checked }))} />
          <Field label={t("rules.sendHour")} hint={t("rules.sendHourHint")}>
            <Select value={String(f.sendHour)} onChange={(e) => setF((o) => ({ ...o, sendHour: Number(e.target.value) }))}>
              {Array.from({ length: 15 }, (_, i) => i + 7).map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold">{t("rules.title")}</h3>
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
            {f.rows.map((r, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
                <div className="flex items-center gap-2">
                  {r.when !== "on" && (
                    <div className="w-16">
                      <Input inputMode="numeric" value={r.days} onChange={(e) => setRow(i, { days: e.target.value })} className="text-center font-mono" aria-label={t("rules.days")} />
                    </div>
                  )}
                  <div className="w-40">
                    <Select value={r.when} onChange={(e) => setRow(i, { when: e.target.value, days: e.target.value === "on" ? "0" : r.days === "0" ? "1" : r.days })} aria-label={t("rules.when")}>
                      <option value="before">{t("rules.before")}</option>
                      <option value="on">{t("rules.on")}</option>
                      <option value="after">{t("rules.after")}</option>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-2">
                  <Checkbox label={t("rules.active")} checked={r.enabled} onChange={(e) => setRow(i, { enabled: e.target.checked })} />
                  <Checkbox label="SMS" checked={r.sms} onChange={(e) => setRow(i, { sms: e.target.checked })} />
                  <Checkbox label={t("email")} checked={r.email} onChange={(e) => setRow(i, { email: e.target.checked })} />
                </div>
                <Button size="sm" variant="ghost" onClick={() => setF((o) => ({ ...o, rows: o.rows.filter((_, j) => j !== i) }))} aria-label={t("rules.remove")} disabled={f.rows.length <= 1}>
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
          {f.rows.length < MAX_RULES && (
            <Button size="sm" variant="secondary" className="mt-3" onClick={add}>
              <Plus aria-hidden className="size-3.5" />
              {t("rules.add")}
            </Button>
          )}
          <p className="mt-4 text-xs leading-relaxed text-ink-muted">{t("rules.note")}</p>
        </div>
      </fieldset>

      {editable && dirty && (
        <div className="toast-in sticky bottom-4 z-20 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-lg border border-primary bg-primary px-4 py-3 text-primary-ink">
          <span className="text-sm">{t("rules.unsaved")}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="text-primary-ink hover:bg-white/10" onClick={() => (setF(initial), setError(null))}>
              {t("rules.discard")}
            </Button>
            <Button size="sm" variant="accent" type="submit" loading={busy}>
              {tc("save")}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}

/**
 * The rules on one line around the due date — a drafting-style scale so the owner sees at a
 * glance when a buyer hears from the company. Off rules are hollow.
 */
function RuleTimeline({ rows }) {
  const t = useTranslations("review.reminders");
  const label = useRuleLabel();
  const valid = rows.filter((r) => r.when === "on" || /^\d{1,3}$/.test(r.days.trim())).map((r) => ({ ...r, d: offsetOf(r) })).sort((a, b) => a.d - b.d);
  const min = Math.min(-7, ...valid.map((r) => r.d));
  const max = Math.max(15, ...valid.map((r) => r.d));
  const pos = (d) => `${((d - min) / (max - min)) * 100}%`;
  return (
    <figure className="blueprint rounded-lg border border-line bg-surface px-6 pt-6 pb-4" aria-label={t("rules.timeline")}>
      <div className="relative mx-6 h-24">
        <div className="absolute inset-x-0 top-9 h-px bg-line-strong/60" />
        <div className="absolute top-3 bottom-4 w-px bg-primary" style={{ left: pos(0) }} />
        <span className="absolute top-0 -translate-x-1/2 rounded-sm bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-ink" style={{ left: pos(0) }}>
          {t("rules.dueDate")}
        </span>
        {valid.map((r, i) => (
          <div key={i} className="absolute top-9 -translate-x-1/2" style={{ left: pos(r.d) }}>
            <span className={cn("block size-3 -translate-y-1/2 rounded-full border-2", r.enabled ? (r.d > 0 ? "border-danger bg-danger" : "border-primary bg-primary") : "border-line-strong bg-surface")} />
            <span className={cn("block text-center text-[11px] whitespace-nowrap", i % 2 ? "mt-6" : "mt-1.5", r.enabled ? "text-ink" : "text-ink-subtle line-through")}>{label(r.d)}</span>
          </div>
        ))}
      </div>
      <figcaption className="mt-2 text-xs text-ink-muted">{t("rules.timelineNote")}</figcaption>
    </figure>
  );
}
