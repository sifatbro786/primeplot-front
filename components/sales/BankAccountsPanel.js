"use client";

import { useState } from "react";
import { Landmark, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { useSalesError } from "@/lib/sales/errors";
import { useBankAccounts } from "@/lib/sales/queries";

const FIELDS = ["name", "bankName", "branch", "accountName", "accountNo", "routingNo"];

/** Company bank accounts that receive transfers and cheque deposits. Never deleted — deactivated. */
export function BankAccountsPanel() {
  const t = useTranslations("sales.accounts.banks");
  const tc = useTranslations("common");
  const locale = useLocale();
  const salesError = useSalesError();
  const { can } = useSession();
  const editable = can("accounts:settings");
  const list = useBankAccounts({});
  const [edit, setEdit] = useState(null); // null | "new" | account

  const add = editable && (
    <Button size="sm" onClick={() => setEdit("new")}>
      <Plus aria-hidden className="size-4" />
      {t("new")}
    </Button>
  );

  return (
    <div>
      <div className="mb-5 flex items-end justify-between gap-4">
        <p className="max-w-xl text-sm text-ink-muted">{t("intro")}</p>
        {list.data?.length > 0 && add}
      </div>
      {list.isError ? (
        <ErrorState title={t("loadFailed")} description={salesError(list.error, locale)} requestId={list.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : list.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : list.data.length === 0 ? (
        <EmptyState icon={Landmark} title={t("emptyTitle")} description={t("emptyBody")} action={add} />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>{t("cols.account")}</TH>
              <TH>{t("cols.number")}</TH>
              <TH className="hidden md:table-cell">{t("cols.branch")}</TH>
              <TH>{t("cols.status")}</TH>
            </tr>
          </THead>
          <TBody>
            {list.data.map((b) => (
              <TR key={b.id} className={editable ? "cursor-pointer" : undefined} onClick={editable ? () => setEdit(b) : undefined}>
                <TD>
                  <span className="font-medium">{b.name}</span>
                  <span className="block text-[11px] text-ink-subtle">{b.bankName}</span>
                </TD>
                <TD className="font-mono text-[13px]">{b.accountNo}</TD>
                <TD className="hidden text-ink-muted md:table-cell">{b.branch ?? "—"}</TD>
                <TD>{b.active ? <Tag tone="success">{t("active")}</Tag> : <Tag tone="outline">{t("inactive")}</Tag>}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <Drawer open={Boolean(edit)} onClose={() => setEdit(null)} title={edit === "new" ? t("newTitle") : t("editTitle")} width="sm">
        {edit && <BankForm key={edit === "new" ? "new" : edit.id} account={edit === "new" ? null : edit} onDone={() => setEdit(null)} />}
      </Drawer>
    </div>
  );
}

function BankForm({ account, onDone }) {
  const t = useTranslations("sales.accounts.banks");
  const tv = useTranslations("sales.validation");
  const tc = useTranslations("common");
  const locale = useLocale();
  const salesError = useSalesError();
  const qc = useQueryClient();
  const [f, setF] = useState(() => ({ ...Object.fromEntries(FIELDS.map((k) => [k, account?.[k] ?? ""])), active: account?.active ?? true }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((o) => ({ ...o, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(FIELDS.map((k) => [k, f[k].trim()]));
    const err = {};
    if (v.name.length < 2) err.name = tv("min2");
    if (v.bankName.length < 2) err.bankName = tv("min2");
    if (!/^[0-9A-Za-z-]{4,40}$/.test(v.accountNo)) err.accountNo = tv("accountNo");
    if (v.routingNo && !/^\d{9}$/.test(v.routingNo)) err.routingNo = tv("routingNo");
    setErrors(err);
    if (Object.keys(err).length) return;
    const body = { name: v.name, bankName: v.bankName, accountNo: v.accountNo, branch: v.branch || null, accountName: v.accountName || null, routingNo: v.routingNo || null, active: f.active };
    setBusy(true);
    try {
      if (account) await api.patch(`/accounts/bank-accounts/${account.id}`, { version: account.version, ...body });
      else await api.post("/accounts/bank-accounts", body);
      qc.invalidateQueries({ queryKey: ["accounts", "banks"] });
      toast.success(t("saved"));
      onDone();
    } catch (e2) {
      if (e2?.code === "DUPLICATE") setErrors({ accountNo: t("duplicate") });
      else setErrors({ root: salesError(e2, locale) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <FormAlert>{errors.root}</FormAlert>
      <Field label={t("fields.name")} hint={t("hints.name")} error={errors.name} required>
        <Input value={f.name} onChange={set("name")} maxLength={120} />
      </Field>
      <Field label={t("fields.bankName")} error={errors.bankName} required>
        <Input value={f.bankName} onChange={set("bankName")} maxLength={120} />
      </Field>
      <Field label={t("fields.branch")}>
        <Input value={f.branch} onChange={set("branch")} maxLength={120} />
      </Field>
      <Field label={t("fields.accountName")}>
        <Input value={f.accountName} onChange={set("accountName")} maxLength={160} />
      </Field>
      <Field label={t("fields.accountNo")} error={errors.accountNo} required>
        <Input className="font-mono text-[13px]" value={f.accountNo} onChange={set("accountNo")} maxLength={40} />
      </Field>
      <Field label={t("fields.routingNo")} error={errors.routingNo}>
        <Input inputMode="numeric" className="font-mono text-[13px]" value={f.routingNo} onChange={set("routingNo")} maxLength={9} />
      </Field>
      <Checkbox label={t("fields.active")} description={t("hints.active")} checked={f.active} onChange={set("active")} />
      <div className="flex justify-end gap-2 border-t border-line pt-4">
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
