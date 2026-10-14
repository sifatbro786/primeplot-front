"use client";

import { Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";

const blank = () => ({ name: "", relation: "", phone: "", nid: "", sharePct: "" });

/** Client checks (zNominees): ≤ 5, name/relation ≥ 2, NID shape, shares whole % adding to 100. */
export function checkNominees(list) {
  const e = {};
  list.forEach((n, i) => {
    if (n.name.trim().length < 2) e[`${i}.name`] = "min2";
    if (n.relation.trim().length < 2) e[`${i}.relation`] = "min2";
    if (n.nid.trim() && !/^(\d{10}|\d{13}|\d{17})$/.test(n.nid.trim())) e[`${i}.nid`] = "nid";
    const s = Number(n.sharePct);
    if (!/^\d{1,3}$/.test(String(n.sharePct).trim()) || s < 1 || s > 100) e[`${i}.sharePct`] = "share";
  });
  const sum = list.reduce((s, n) => s + (Number(n.sharePct) || 0), 0);
  if (list.length && sum !== 100) e.total = "shares100";
  return e;
}

export const nomineesBody = (list) =>
  list.map((n) => ({
    name: n.name.trim(),
    relation: n.relation.trim(),
    phone: n.phone.trim() || null,
    nid: n.nid.trim() || null,
    sharePct: Number(n.sharePct),
  }));

export const nomineesToForm = (list = []) =>
  list.map((n) => ({ name: n.name ?? "", relation: n.relation ?? "", phone: n.phone ?? "", nid: n.nid ?? "", sharePct: String(n.sharePct ?? "") }));

export function NomineesEditor({ value, onChange, errors = {} }) {
  const t = useTranslations("sales.nominees");
  const tv = useTranslations("sales.validation");
  const locale = useLocale();
  const set = (i, patch) => onChange(value.map((n, j) => (j === i ? { ...n, ...patch } : n)));
  const err = (k) => (errors[k] ? tv(errors[k]) : undefined);
  const sum = value.reduce((s, n) => s + (Number(n.sharePct) || 0), 0);

  return (
    <div className="space-y-4">
      {value.map((n, i) => (
        <div key={i} className="grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-6">
          <Field label={t("name")} error={err(`${i}.name`)} className="sm:col-span-3" required>
            <Input value={n.name} onChange={(e) => set(i, { name: e.target.value })} maxLength={160} />
          </Field>
          <Field label={t("relation")} error={err(`${i}.relation`)} className="sm:col-span-2" required>
            <Input value={n.relation} onChange={(e) => set(i, { relation: e.target.value })} maxLength={60} placeholder={t("relationPlaceholder")} />
          </Field>
          <Field label={t("share")} error={err(`${i}.sharePct`)} required>
            <Input inputMode="numeric" className="font-mono text-[13px]" value={n.sharePct} onChange={(e) => set(i, { sharePct: e.target.value })} trailing={<span className="pr-1 text-sm text-ink-muted">%</span>} />
          </Field>
          <Field label={t("phone")} className="sm:col-span-3">
            <Input type="tel" inputMode="tel" className="font-mono text-[13px]" value={n.phone} onChange={(e) => set(i, { phone: e.target.value })} maxLength={30} />
          </Field>
          <Field label={t("nid")} error={err(`${i}.nid`)} className="sm:col-span-2">
            <Input inputMode="numeric" className="font-mono text-[13px]" value={n.nid} onChange={(e) => set(i, { nid: e.target.value })} maxLength={17} />
          </Field>
          <div className="flex items-end pb-1">
            <Button size="sm" variant="ghost" className="text-danger" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={t("remove")}>
              <Trash2 aria-hidden className="size-4" />
            </Button>
          </div>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button size="sm" variant="secondary" disabled={value.length >= 5} onClick={() => onChange([...value, { ...blank(), sharePct: value.length ? "" : "100" }])}>
          <Plus aria-hidden className="size-3.5" />
          {t("add")}
        </Button>
        {value.length > 0 && (
          <p className={cn("text-xs", sum === 100 ? "text-ink-muted" : "font-medium text-danger")}>{t("sum", { n: formatNumber(sum, locale) })}</p>
        )}
      </div>
      {errors.total && <p className="text-xs font-medium text-danger" role="alert">{tv(errors.total)}</p>}
    </div>
  );
}
