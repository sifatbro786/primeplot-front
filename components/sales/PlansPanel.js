"use client";

import { useState } from "react";
import { CalendarRange, Plus, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Tag } from "@/components/ui/Tag";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { useProjectOptions } from "@/lib/crm/queries";
import { formatNumber, poishaToTaka, takaToPoisha } from "@/lib/format";
import { useSalesError } from "@/lib/sales/errors";
import { bpsToPct, pctToBps, samplePlan } from "@/lib/sales/money";
import { usePlans } from "@/lib/sales/queries";
import { MoneyInput, localName, useMoney } from "./parts";

const EVERY = [1, 2, 3, 4, 6, 12];
const SAMPLE = 1_000_000_000; // ৳1 crore in poisha

/** One-line description of a plan template: "10 % booking · 20 % down in 15 days · 36 × monthly · 10 % at handover". */
export function usePlanSummary() {
  const t = useTranslations("sales.plans.summary");
  const locale = useLocale();
  const money = useMoney();
  const num = (n) => formatNumber(n, locale);
  const part = (p) => (p.type === "percent" ? `${num(p.value / 100)}%` : money(p.value));
  return (spec) => {
    if (!spec) return "";
    const out = [t("booking", { v: part(spec.bookingMoney) })];
    if (spec.downPayment) out.push(t("down", { v: part(spec.downPayment), days: num(spec.downPayment.dueAfterDays ?? 0) }));
    if (spec.installments?.count) out.push(t("installments", { n: num(spec.installments.count), every: num(spec.installments.everyMonths) }));
    for (const m of spec.milestones ?? []) out.push(`${(locale === "bn" && m.labelBn) || m.label} ${part(m)}`);
    if (spec.handover) out.push(spec.handover.type === "balance" ? t("handoverBalance") : t("handover", { v: part(spec.handover) }));
    return out.join(" · ");
  };
}

/** Payment plan templates (company-wide or per project). */
export function PlansPanel() {
  const t = useTranslations("sales.plans");
  const tc = useTranslations("common");
  const locale = useLocale();
  const salesError = useSalesError();
  const summary = usePlanSummary();
  const { can } = useSession();
  const editable = can("plans:manage");
  const projects = useProjectOptions();
  const [projectId, setProjectId] = useState("");
  const list = usePlans({ projectId: projectId || undefined });
  const [edit, setEdit] = useState(null);
  const projectName = (id) => localName((projects.data ?? []).find((p) => p.id === id), locale) || "—";

  const add = editable && (
    <Button size="sm" onClick={() => setEdit("new")}>
      <Plus aria-hidden className="size-4" />
      {t("new")}
    </Button>
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="w-full max-w-xs">
          <Field label={t("filterProject")}>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">{t("allPlans")}</option>
              {(projects.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {localName(p, locale)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {list.data?.length > 0 && add}
      </div>

      {list.isError ? (
        <ErrorState title={t("loadFailed")} description={salesError(list.error, locale)} requestId={list.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : list.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : list.data.length === 0 ? (
        <EmptyState icon={CalendarRange} title={t("emptyTitle")} description={t("emptyBody")} action={add} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.data.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={!editable}
                onClick={() => setEdit(p)}
                className="flex h-full w-full flex-col rounded-lg border border-line bg-surface p-4 text-left transition-colors enabled:hover:border-line-strong disabled:cursor-default"
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <span className="font-medium">{localName(p, locale)}</span>
                  {!p.active && <Tag tone="outline">{t("inactive")}</Tag>}
                </div>
                <span className="mt-1 text-[11px] tracking-wide text-ink-subtle uppercase">{p.projectId ? projectName(p.projectId) : t("companyWide")}</span>
                <span className="mt-3 text-sm leading-relaxed text-ink-muted">{summary(p.spec)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Drawer open={Boolean(edit)} onClose={() => setEdit(null)} title={edit === "new" ? t("newTitle") : t("editTitle")} width="lg">
        {edit && <PlanForm key={edit === "new" ? "new" : `${edit.id}:${edit.version}`} plan={edit === "new" ? null : edit} projects={projects.data ?? []} onDone={() => setEdit(null)} />}
      </Drawer>
    </div>
  );
}

const partToForm = (p, fallbackType = "percent") => ({
  type: p?.type ?? fallbackType,
  value: p ? (p.type === "fixed" ? poishaToTaka(p.value) : p.type === "percent" ? bpsToPct(p.value) : "") : "",
});

function toForm(plan) {
  const s = plan?.spec ?? {};
  return {
    name: plan?.name ?? "",
    nameBn: plan?.nameBn ?? "",
    description: plan?.description ?? "",
    projectId: plan?.projectId ?? "",
    active: plan?.active ?? true,
    sortOrder: String(plan?.sortOrder ?? 0),
    bookingMoney: partToForm(s.bookingMoney ?? { type: "percent", value: 1000 }),
    down: Boolean(s.downPayment),
    downPayment: { ...partToForm(s.downPayment ?? { type: "percent", value: 2000 }), days: String(s.downPayment?.dueAfterDays ?? 15) },
    inst: plan ? Boolean(s.installments?.count) : true,
    installments: {
      count: String(s.installments?.count ?? 36),
      everyMonths: String(s.installments?.everyMonths ?? 1),
      first: s.installments?.firstDueAfterMonths != null ? String(s.installments.firstDueAfterMonths) : "",
    },
    milestones: (s.milestones ?? []).map((m) => ({ key: m.key, label: m.label, labelBn: m.labelBn ?? "", ...partToForm(m) })),
    handover: s.handover ? { ...partToForm(s.handover), type: s.handover.type } : { type: plan ? "none" : "none", value: "" },
  };
}

/** Form → { spec, errors }. Amount rules = zPlanSpec. */
function buildSpec(f) {
  const errors = {};
  const part = (p, key) => {
    if (p.type === "percent") {
      const v = pctToBps(p.value);
      if (v == null || v < 1 || v > 10_000) errors[key] = "percent";
      return { type: "percent", value: v ?? 0 };
    }
    const v = takaToPoisha(p.value);
    if (v == null || v < 1) errors[key] = "amount";
    return { type: "fixed", value: v ?? 0 };
  };
  const spec = { bookingMoney: part(f.bookingMoney, "bookingMoney") };
  if (f.down) {
    const days = Number(f.downPayment.days);
    if (!/^\d{1,3}$/.test(f.downPayment.days) || days > 365) errors.downDays = "days365";
    spec.downPayment = { ...part(f.downPayment, "downPayment"), dueAfterDays: days || 0 };
  } else spec.downPayment = null;
  if (f.inst) {
    const count = Number(f.installments.count);
    if (!/^\d{1,3}$/.test(f.installments.count) || count < 1 || count > 240) errors.count = "count240";
    const first = f.installments.first.trim();
    if (first && (!/^\d{1,2}$/.test(first) || Number(first) > 36)) errors.first = "months36";
    spec.installments = { count, everyMonths: Number(f.installments.everyMonths), ...(first && { firstDueAfterMonths: Number(first) }) };
  } else spec.installments = null;
  const keys = new Set();
  spec.milestones = f.milestones.map((m, i) => {
    if (!/^[a-z0-9_]{1,40}$/.test(m.key) || keys.has(m.key)) errors[`m${i}key`] = "milestoneKey";
    keys.add(m.key);
    if (m.label.trim().length < 2) errors[`m${i}label`] = "min2";
    return { key: m.key, label: m.label.trim(), ...(m.labelBn.trim() && { labelBn: m.labelBn.trim() }), ...part(m, `m${i}value`) };
  });
  if (f.handover.type === "none") spec.handover = null;
  else if (f.handover.type === "balance") spec.handover = { type: "balance" };
  else spec.handover = part(f.handover, "handover");
  // Exactly one part takes the balance.
  if (f.inst === (f.handover.type === "balance")) errors.balance = f.inst ? "balanceTwice" : "balanceNone";
  return { spec, errors };
}

function PartInput({ value, onChange, error, label, allowFixed = true }) {
  const t = useTranslations("sales.plans");
  return (
    <Field label={label} error={error}>
      <div className="flex gap-2">
        <div className="w-32 shrink-0">
          <Select value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value, value: "" })} aria-label={t("amountType")}>
            <option value="percent">{t("types.percent")}</option>
            {allowFixed && <option value="fixed">{t("types.fixed")}</option>}
          </Select>
        </div>
        <div className="flex-1">
          {value.type === "percent" ? (
            <Input inputMode="decimal" className="font-mono text-[13px]" value={value.value} onChange={(e) => onChange({ ...value, value: e.target.value })} trailing={<span className="pr-1 text-sm text-ink-muted">%</span>} />
          ) : (
            <MoneyInput value={value.value} onChange={(v) => onChange({ ...value, value: v })} showWords={false} />
          )}
        </div>
      </div>
    </Field>
  );
}

function PlanForm({ plan, projects, onDone }) {
  const t = useTranslations("sales.plans");
  const tv = useTranslations("sales.validation");
  const tc = useTranslations("common");
  const locale = useLocale();
  const money = useMoney();
  const salesError = useSalesError();
  const qc = useQueryClient();
  const [f, setF] = useState(() => toForm(plan));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (k) => (v) => setF((o) => ({ ...o, [k]: v?.target ? (v.target.type === "checkbox" ? v.target.checked : v.target.value) : v }));
  const msg = (k) => (errors[k] ? (tv.has(errors[k]) ? tv(errors[k]) : errors[k]) : undefined);

  const built = buildSpec(f);
  const sample = Object.keys(built.errors).length ? null : samplePlan(built.spec, SAMPLE);

  const submit = async (e) => {
    e.preventDefault();
    const err = { ...built.errors };
    if (f.name.trim().length < 2) err.name = "min2";
    setErrors(err);
    if (Object.keys(err).length) return;
    const body = {
      name: f.name.trim(),
      nameBn: f.nameBn.trim() || null,
      description: f.description.trim() || null,
      projectId: f.projectId || null,
      active: f.active,
      sortOrder: Number(f.sortOrder) || 0,
      spec: built.spec,
    };
    setBusy(true);
    try {
      if (plan) await api.patch(`/payment-plans/${plan.id}`, { version: plan.version, ...body });
      else await api.post("/payment-plans", body);
      qc.invalidateQueries({ queryKey: ["payment-plans"] });
      toast.success(t("saved"));
      onDone();
    } catch (e2) {
      setErrors({ root: salesError(e2, locale) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/payment-plans/${plan.id}`);
      qc.invalidateQueries({ queryKey: ["payment-plans"] });
      toast.success(t("deleted"));
      onDone();
    } catch (e2) {
      setErrors({ root: salesError(e2, locale) });
      setBusy(false);
    }
  };

  const setMilestone = (i, patch) => setF((o) => ({ ...o, milestones: o.milestones.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <FormAlert>{errors.root}</FormAlert>

      <fieldset className="space-y-5">
        <legend className="eyebrow mb-4">{t("sections.about")}</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("fields.name")} error={msg("name")} required>
            <Input value={f.name} onChange={set("name")} maxLength={120} placeholder={t("namePlaceholder")} />
          </Field>
          <Field label={t("fields.nameBn")}>
            <Input lang="bn" value={f.nameBn} onChange={set("nameBn")} maxLength={120} />
          </Field>
        </div>
        <Field label={t("fields.description")}>
          <Input value={f.description} onChange={set("description")} maxLength={500} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-[1fr_120px]">
          <Field label={t("fields.project")} hint={t("hints.project")}>
            <Select value={f.projectId} onChange={set("projectId")}>
              <option value="">{t("companyWide")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {localName(p, locale)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.sortOrder")}>
            <Input inputMode="numeric" className="font-mono text-[13px]" value={f.sortOrder} onChange={set("sortOrder")} />
          </Field>
        </div>
        <Checkbox label={t("fields.active")} description={t("hints.active")} checked={f.active} onChange={set("active")} />
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="eyebrow mb-4">{t("sections.parts")}</legend>
        <PartInput label={t("fields.bookingMoney")} value={f.bookingMoney} onChange={set("bookingMoney")} error={msg("bookingMoney")} />

        <div className="rounded-lg border border-line p-4">
          <Checkbox label={t("fields.downPayment")} checked={f.down} onChange={set("down")} />
          {f.down && (
            <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_160px]">
              <PartInput label={t("fields.amount")} value={f.downPayment} onChange={(v) => setF((o) => ({ ...o, downPayment: { ...o.downPayment, ...v } }))} error={msg("downPayment")} />
              <Field label={t("fields.dueAfterDays")} error={msg("downDays")}>
                <Input inputMode="numeric" className="font-mono text-[13px]" value={f.downPayment.days} onChange={(e) => setF((o) => ({ ...o, downPayment: { ...o.downPayment, days: e.target.value } }))} />
              </Field>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-line p-4">
          <Checkbox label={t("fields.installments")} description={t("hints.installments")} checked={f.inst} onChange={set("inst")} />
          {f.inst && (
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label={t("fields.count")} error={msg("count")}>
                <Input inputMode="numeric" className="font-mono text-[13px]" value={f.installments.count} onChange={(e) => setF((o) => ({ ...o, installments: { ...o.installments, count: e.target.value } }))} />
              </Field>
              <Field label={t("fields.everyMonths")}>
                <Select value={f.installments.everyMonths} onChange={(e) => setF((o) => ({ ...o, installments: { ...o.installments, everyMonths: e.target.value } }))}>
                  {EVERY.map((m) => (
                    <option key={m} value={m}>
                      {t("every", { n: formatNumber(m, locale) })}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("fields.firstAfter")} hint={t("hints.firstAfter")} error={msg("first")}>
                <Input inputMode="numeric" className="font-mono text-[13px]" value={f.installments.first} onChange={(e) => setF((o) => ({ ...o, installments: { ...o.installments, first: e.target.value } }))} />
              </Field>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-line p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{t("fields.milestones")}</p>
              <p className="text-xs text-ink-muted">{t("hints.milestones")}</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={f.milestones.length >= 20}
              onClick={() => setF((o) => ({ ...o, milestones: [...o.milestones, { key: `m${o.milestones.length + 1}`, label: "", labelBn: "", type: "percent", value: "" }] }))}
            >
              <Plus aria-hidden className="size-3.5" />
              {t("addMilestone")}
            </Button>
          </div>
          {f.milestones.map((m, i) => (
            <div key={i} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-[110px_1fr_1fr_auto]">
              <Field label={t("fields.key")} error={msg(`m${i}key`)}>
                <Input className="font-mono text-[12px]" value={m.key} onChange={(e) => setMilestone(i, { key: e.target.value.toLowerCase() })} maxLength={40} />
              </Field>
              <Field label={t("fields.label")} error={msg(`m${i}label`)}>
                <Input value={m.label} onChange={(e) => setMilestone(i, { label: e.target.value })} placeholder={t("milestonePlaceholder")} maxLength={120} />
              </Field>
              <Field label={t("fields.labelBn")}>
                <Input lang="bn" value={m.labelBn} onChange={(e) => setMilestone(i, { labelBn: e.target.value })} maxLength={120} />
              </Field>
              <div className="flex items-end pb-1">
                <Button size="icon" variant="ghost" className="size-9 text-danger" onClick={() => setF((o) => ({ ...o, milestones: o.milestones.filter((_, j) => j !== i) }))} aria-label={t("removeMilestone")}>
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </div>
              <div className="sm:col-span-4">
                <PartInput label={t("fields.amount")} value={m} onChange={(v) => setMilestone(i, { type: v.type, value: v.value })} error={msg(`m${i}value`)} />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-line p-4">
          <Field label={t("fields.handover")} error={msg("balance")}>
            <Select value={f.handover.type} onChange={(e) => setF((o) => ({ ...o, handover: { type: e.target.value, value: "" } }))}>
              <option value="none">{t("handoverTypes.none")}</option>
              <option value="percent">{t("handoverTypes.percent")}</option>
              <option value="fixed">{t("handoverTypes.fixed")}</option>
              <option value="balance">{t("handoverTypes.balance")}</option>
            </Select>
          </Field>
          {["percent", "fixed"].includes(f.handover.type) && (
            <div className="mt-4">
              <PartInput label={t("fields.amount")} value={f.handover} onChange={(v) => setF((o) => ({ ...o, handover: v }))} error={msg("handover")} />
            </div>
          )}
        </div>
      </fieldset>

      <section className="rounded-lg border border-line bg-surface-2/60 p-4">
        <p className="eyebrow">{t("sample.title", { amount: money(SAMPLE) })}</p>
        {!sample ? (
          <p className="mt-3 text-sm text-ink-muted">{t("sample.fix")}</p>
        ) : sample.error ? (
          <p className="mt-3 text-sm text-danger">{tv(sample.error === "PLAN_EXCEEDS_PRICE" ? "planExceeds" : "invalidPlan")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-line text-sm">
            {sample.rows.map((r, i) => (
              <li key={i} className="flex items-baseline justify-between gap-4 py-2">
                <span>
                  {r.code === "milestone" ? (locale === "bn" && r.labelBn) || r.label : t(`sample.${r.code}`, { n: formatNumber(r.count ?? 0, locale), every: formatNumber(r.every ?? 1, locale), days: formatNumber(r.days ?? 0, locale) })}
                  {r.balance && <span className="ml-2 text-xs text-ink-subtle">{t("sample.balance")}</span>}
                </span>
                <span className="text-right font-mono text-[13px] tabular-nums">
                  {money(r.amount)}
                  {r.code === "installment" && r.last !== r.amount && <span className="block text-[11px] text-ink-subtle">{t("sample.last", { amount: money(r.last) })}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="sticky bottom-0 -mx-6 -mb-5 flex items-center justify-end gap-2 border-t border-line bg-surface px-6 py-4">
        {plan &&
          (confirmDelete ? (
            <span className="mr-auto flex items-center gap-2">
              <Button size="sm" variant="danger" loading={busy} onClick={remove}>
                {t("confirmDelete")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                {tc("cancel")}
              </Button>
            </span>
          ) : (
            <Button variant="ghost" className="mr-auto text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden className="size-4" />
              {t("delete")}
            </Button>
          ))}
        <Button variant="ghost" onClick={onDone}>
          {tc("cancel")}
        </Button>
        <Button type="submit" loading={busy}>
          {tc("save")}
        </Button>
      </div>
    </form>
  );
}
