"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { useProject } from "@/components/inventory/queries";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { poishaToTaka, takaToPoisha } from "@/lib/format";
import { useSalesError } from "@/lib/sales/errors";
import { bpsToPct, pctToBps } from "@/lib/sales/money";
import { MoneyInput, Section } from "./parts";

/** Project › Sales tab: the document code (LVR-BK-00001, LVR-2627-000123) and the sales policy. */
export function ProjectSalesTab() {
  const { id } = useParams();
  const project = useProject(id);
  if (!project.data) return <Skeleton className="h-80 w-full" />;
  return <SalesForm key={`${project.data.id}:${project.data.version}`} project={project.data} />;
}

function SalesForm({ project }) {
  const t = useTranslations("sales.projectSales");
  const tv = useTranslations("sales.validation");
  const tc = useTranslations("common");
  const locale = useLocale();
  const salesError = useSalesError();
  const qc = useQueryClient();
  const { can } = useSession();
  const editable = can("projects:write");
  // Once numbers were issued with a code the API freezes it (409 PROJECT_CODE_LOCKED).
  const codeLocked = Boolean(project.codeLocked);
  const initial = {
    code: project.code ?? "",
    deduction: bpsToPct(project.salesPolicy?.cancellationDeductionBps ?? 1000),
    transferFee: poishaToTaka(project.salesPolicy?.transferFee ?? 0),
  };
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((o) => ({ ...o, [k]: v?.target ? v.target.value : v }));
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);

  const save = async (e) => {
    e.preventDefault();
    const code = f.code.trim().toUpperCase();
    const bps = pctToBps(f.deduction);
    const fee = f.transferFee.trim() === "" ? 0 : takaToPoisha(f.transferFee);
    const err = {};
    if (code && !/^[A-Z][A-Z0-9]{1,5}$/.test(code)) err.code = tv("projectCode");
    if (bps == null || bps > 10_000) err.deduction = tv("percent");
    if (fee == null || fee < 0) err.transferFee = tv("amount");
    setErrors(err);
    if (Object.keys(err).length) return;
    const patch = { version: project.version };
    if (code !== (project.code ?? "")) patch.code = code || null;
    const sp = {};
    if (bps !== (project.salesPolicy?.cancellationDeductionBps ?? 1000)) sp.cancellationDeductionBps = bps;
    if (fee !== (project.salesPolicy?.transferFee ?? 0)) sp.transferFee = fee;
    if (Object.keys(sp).length) patch.salesPolicy = sp;
    if (Object.keys(patch).length === 1) return;
    setBusy(true);
    try {
      const updated = await api.patch(`/projects/${project.id}`, patch);
      qc.setQueryData(["project", project.id], updated);
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("saved"));
    } catch (e2) {
      if (e2?.code === "DUPLICATE") setErrors({ code: t("codeTaken") });
      else if (e2?.code === "PROJECT_CODE_LOCKED") setErrors({ code: t("code.locked") });
      else setErrors({ root: salesError(e2, locale) });
    } finally {
      setBusy(false);
    }
  };

  const sampleCode = (f.code.trim().toUpperCase() || "LVR").slice(0, 6);
  return (
    <form onSubmit={save} noValidate className="max-w-5xl">
      <FormAlert>{errors.root}</FormAlert>
      <fieldset disabled={!editable || busy}>
        <Section title={t("code.title")} description={t("code.body")}>
          <Field label={t("code.label")} hint={codeLocked ? t("code.locked") : t("code.hint")} error={errors.code}>
            <Input
              className="font-mono text-[13px] uppercase sm:max-w-40"
              value={f.code}
              onChange={set("code")}
              maxLength={6}
              disabled={codeLocked}
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
          <dl className="grid gap-3 rounded-md border border-dashed border-line-strong/70 px-4 py-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[11px] tracking-wide text-ink-subtle uppercase">{t("code.bookingNo")}</dt>
              <dd className="mt-1 font-mono">{sampleCode}-BK-00001</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-wide text-ink-subtle uppercase">{t("code.receiptNo")}</dt>
              <dd className="mt-1 font-mono">{sampleCode}-2627-000001</dd>
            </div>
          </dl>
        </Section>

        <Section title={t("policy.title")} description={t("policy.body")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t("policy.deduction")} hint={t("policy.deductionHint")} error={errors.deduction}>
              <Input inputMode="decimal" className="font-mono text-[13px]" value={f.deduction} onChange={set("deduction")} trailing={<span className="pr-1 text-sm text-ink-muted">%</span>} />
            </Field>
            <Field label={t("policy.transferFee")} hint={t("policy.transferFeeHint")} error={errors.transferFee}>
              <MoneyInput value={f.transferFee} onChange={set("transferFee")} />
            </Field>
          </div>
        </Section>
      </fieldset>
      {editable && (
        <div className="flex justify-end gap-2 border-t border-line pt-5">
          <Button variant="ghost" disabled={!dirty || busy} onClick={() => (setF(initial), setErrors({}))}>
            {t("discard")}
          </Button>
          <Button type="submit" disabled={!dirty} loading={busy}>
            {tc("save")}
          </Button>
        </div>
      )}
    </form>
  );
}
