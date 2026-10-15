"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { Tag } from "@/components/ui/Tag";
import { toast } from "@/components/ui/Toast";
import { Fact } from "@/components/sales/parts";
import { api } from "@/lib/api/client";
import { ME_KEY } from "@/lib/auth/session";
import { formatNumber, formatPhone } from "@/lib/format";
import { portalKeys, usePortalMe, usePortalRefresh, useProfileRequests } from "@/lib/portal/queries";
import { useDate, usePortalError } from "./parts";

/** Contact fields a client may ask to change (name, parents, NID, DOB, TIN change at the office). */
export const CONTACT_FIELDS = ["phone", "altPhone", "email", "presentAddress", "permanentAddress", "foreignAddress", "occupation", "organization"];
const LONG = new Set(["presentAddress", "permanentAddress", "foreignAddress"]);

const REQ_TONE = { pending: "warning", approved: "success", rejected: "danger", withdrawn: "neutral" };

/** Portal › Account: the buyer record (read-only), change requests and the message language. */
export function PortalProfile() {
  const t = useTranslations("portal.profile");
  const tc = useTranslations("common");
  const locale = useLocale();
  const date = useDate();
  const portalError = usePortalError();
  const refresh = usePortalRefresh();
  const qc = useQueryClient();
  const me = usePortalMe();
  const requests = useProfileRequests();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(null);

  if (me.isError) return <ErrorState title={t("loadFailed")} description={portalError(me.error)} requestId={me.error?.requestId} requestIdLabel={tc("requestId")} />;
  if (me.isPending) return <Skeleton className="h-72 w-full" />;
  const p = me.data.profile;
  const pending = (requests.data ?? []).find((r) => r.status === "pending") ?? me.data.pendingProfileRequest;
  const history = (requests.data ?? []).filter((r) => r.status !== "pending").slice(0, 3);
  const fmt = (k, v) => (v == null || v === "" ? null : k === "phone" || k === "altPhone" ? formatPhone(v, locale) : v);

  const setLanguage = async (v) => {
    setBusy("locale");
    try {
      await api.patch("/portal/me", { locale: v });
      qc.setQueryData(portalKeys.me, (old) => (old ? { ...old, profile: { ...old.profile, locale: v } } : old));
      qc.invalidateQueries({ queryKey: ME_KEY });
      toast.success(t("languageSaved"));
    } catch (err) {
      toast.error(portalError(err));
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async (r) => {
    setBusy(r.id);
    try {
      await api.post(`/portal/profile-requests/${r.id}/withdraw`);
      refresh();
      toast.success(t("withdrawn"));
    } catch (err) {
      toast.error(portalError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-md border border-line bg-surface p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">{locale === "bn" && p.nameBn ? p.nameBn : p.name}</p>
            <p className="font-mono text-[12px] text-ink-muted">{p.customerNo}</p>
          </div>
          {!pending && (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              <Pencil aria-hidden className="size-3.5" />
              {t("requestChange")}
            </Button>
          )}
        </div>
        <dl className="grid gap-5 sm:grid-cols-2">
          {CONTACT_FIELDS.filter((k) => k !== "foreignAddress" || p.foreignAddress).map((k) => (
            <Fact key={k} label={t(`fields.${k}`)} mono={k === "phone" || k === "altPhone"} className={LONG.has(k) ? "sm:col-span-2" : undefined}>
              {fmt(k, p[k])}
            </Fact>
          ))}
          <Fact label={t("fields.nid")} mono>
            {p.nid ?? p.passportNo}
          </Fact>
        </dl>
        <p className="mt-5 border-t border-line pt-4 text-xs text-ink-muted">{t("officeOnly")}</p>
      </div>

      {pending && (
        <section className="rounded-md border border-warning/30 bg-warning-bg p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium">{t("pendingTitle", { date: date(pending.createdAt) })}</p>
            <Button size="sm" variant="ghost" loading={busy === pending.id} onClick={() => withdraw(pending)}>
              {t("withdraw")}
            </Button>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {Object.entries(pending.changes ?? {}).map(([k, v]) => (
              <li key={k}>
                <span className="text-ink-muted">{t(`fields.${k}`)}:</span> <span className="line-through decoration-ink-muted/60">{fmt(k, pending.before?.[k]) ?? "—"}</span> → <span className="font-medium">{fmt(k, v) ?? t("cleared")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold">{t("historyTitle")}</h3>
          <ul className="space-y-2">
            {history.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Tag tone={REQ_TONE[r.status]}>{t(`status.${r.status}`)}</Tag>
                <span className="text-ink-muted">{date(r.reviewedAt ?? r.createdAt)}</span>
                <span className="min-w-0 truncate">{Object.keys(r.changes ?? {}).map((k) => t(`fields.${k}`)).join(", ")}</span>
                {r.status === "rejected" && r.rejectReason && <span className="w-full text-xs text-danger">{t("rejectedBecause", { reason: r.rejectReason })}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="text-sm font-semibold">{t("languageTitle")}</h3>
        <p className="mt-1 mb-3 text-sm text-ink-muted">{t("languageBody")}</p>
        <Segmented
          value={p.locale ?? locale}
          onChange={setLanguage}
          disabled={busy === "locale"}
          options={[
            { value: "bn", label: "বাংলা" },
            { value: "en", label: "English" },
          ]}
          aria-label={t("languageTitle")}
        />
      </section>

      {editing && <ChangeRequestDrawer profile={p} onClose={() => setEditing(false)} />}
    </div>
  );
}

function ChangeRequestDrawer({ profile, onClose }) {
  const t = useTranslations("portal.profile");
  const locale = useLocale();
  const portalError = usePortalError();
  const refresh = usePortalRefresh();
  const [values, setValues] = useState(() => Object.fromEntries(CONTACT_FIELDS.map((k) => [k, profile[k] ?? ""])));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [busy, setBusy] = useState(false);
  const changed = CONTACT_FIELDS.filter((k) => (values[k] ?? "").trim() !== (profile[k] ?? ""));

  const submit = async () => {
    if (!changed.length) return setFormError(t("noChanges"));
    if (changed.includes("phone") && !values.phone.trim()) return setErrors({ phone: t("phoneRequired") });
    const body = Object.fromEntries(changed.map((k) => [k, values[k].trim() || null]));
    if (note.trim()) body.note = note.trim();
    setBusy(true);
    setFormError(null);
    try {
      await api.post("/portal/profile-requests", body);
      refresh();
      toast.success(t("sent"));
      onClose();
    } catch (err) {
      setBusy(false);
      const fields = Array.isArray(err?.details) ? Object.fromEntries(err.details.filter((d) => d?.path).map((d) => [String(d.path), d.message])) : {};
      if (err?.code === "INVALID_PHONE") fields.phone = t("invalidPhone");
      setErrors(fields);
      if (!Object.keys(fields).length) setFormError(portalError(err));
    }
  };

  return (
    <Drawer
      open
      onClose={busy ? undefined : onClose}
      title={t("drawerTitle")}
      description={t("drawerBody")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} loading={busy} disabled={!changed.length}>
            {t("send", { n: formatNumber(changed.length, locale) })}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {CONTACT_FIELDS.map((k) => (
          <Field key={k} label={t(`fields.${k}`)} error={errors[k]} hint={changed.includes(k) ? t("was", { value: profile[k] || "—" }) : undefined}>
            {LONG.has(k) ? (
              <Textarea rows={2} value={values[k]} onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))} maxLength={500} />
            ) : (
              <Input
                value={values[k]}
                onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
                type={k === "email" ? "email" : k.endsWith("hone") ? "tel" : "text"}
                inputMode={k === "email" ? "email" : k.endsWith("hone") ? "tel" : undefined}
                className={k.endsWith("hone") ? "font-mono" : undefined}
                maxLength={k === "organization" ? 160 : 120}
              />
            )}
          </Field>
        ))}
        <Field label={t("note")} optionalLabel={t("optional")} error={errors.note}>
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
        {formError && (
          <p role="alert" className="rounded-md border border-danger/25 bg-danger-bg px-3.5 py-3 text-sm text-danger">
            {formError}
          </p>
        )}
        <p className="text-xs text-ink-muted">{t("phoneNote")}</p>
      </div>
    </Drawer>
  );
}
