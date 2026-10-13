"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Segmented } from "@/components/ui/Segmented";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { LEAD_TYPES } from "@/lib/crm/constants";
import { useCrmError } from "@/lib/crm/errors";
import { useAssignees, useCrmRefresh } from "@/lib/crm/queries";
import { EMPTY_LEAD, LeadFields, leadSchema, valuesToBody } from "./LeadFields";

const FORM_ID = "lead-create";

function CreateForm({ defaultType, onDone, onBusy, onOpenLead }) {
  const t = useTranslations("crm");
  const tv = useTranslations("crm.validation");
  const tt = useTranslations("crm.types");
  const { can } = useSession();
  const canAssign = can("leads:assign");
  const assignees = useAssignees({ enabled: canAssign });
  const crmError = useCrmError();
  const refresh = useCrmRefresh();
  const [duplicate, setDuplicate] = useState(null); // { leadId, assigneeName } | { hidden: true }
  const form = useForm({ resolver: zodResolver(leadSchema(tv)), defaultValues: { ...EMPTY_LEAD, type: defaultType } });
  const type = useWatch({ control: form.control, name: "type" });

  const onSubmit = async (v) => {
    setDuplicate(null);
    onBusy(true);
    try {
      const lead = await api.post("/leads", valuesToBody(v, "create"));
      toast.success(t("created", { name: lead.name }));
      refresh();
      onDone(lead);
    } catch (err) {
      if (err?.code === "DUPLICATE_LEAD") {
        const d = err.details?.[0];
        setDuplicate(d?.leadId ? { leadId: d.leadId, assigneeName: d.assigneeName } : { hidden: true });
      } else if (err?.code === "INVALID_PHONE") {
        form.setError(err.details?.[0]?.path === "altPhone" ? "altPhone" : "phone", { message: tv("phone") });
      } else {
        form.setError("root", { message: crmError(err) });
      }
    } finally {
      onBusy(false);
    }
  };

  return (
    <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
      <Segmented
        aria-label={t("filters.type")}
        value={type}
        onChange={(v) => form.setValue("type", v, { shouldDirty: true })}
        options={LEAD_TYPES.map((x) => ({ value: x, label: tt(x) }))}
      />
      <FormAlert>{form.formState.errors.root?.message}</FormAlert>
      {duplicate && (
        <div role="alert" className="rounded-md border border-warning/40 bg-warning-bg px-4 py-3 text-sm">
          <p className="font-medium text-warning">{t("duplicate.title")}</p>
          <p className="mt-1 text-ink-muted">
            {duplicate.hidden ? t("duplicate.hidden") : t("duplicate.body", { owner: duplicate.assigneeName ?? t("unassigned") })}
          </p>
          {duplicate.leadId && (
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => onOpenLead(duplicate.leadId)}>
              {t("duplicate.open")}
            </Button>
          )}
        </div>
      )}
      <LeadFields form={form} mode="create" assignees={canAssign ? (assignees.data ?? []) : null} />
    </form>
  );
}

/** "New lead" — manual entry (walk-in, phone call, referral…). */
export function LeadCreateDrawer({ open, onClose, onCreated, onOpenLead, defaultType = "buyer" }) {
  const t = useTranslations("crm");
  const tc = useTranslations("common");
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);

  const close = () => {
    onClose();
    setNonce((n) => n + 1); // fresh form next time
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      title={t("newLead")}
      description={t("newLeadHint")}
      width="md"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} loading={busy}>
            {t("create")}
          </Button>
        </>
      }
    >
      {open && (
        <CreateForm
          key={nonce}
          defaultType={defaultType}
          onBusy={setBusy}
          onDone={(lead) => {
            close();
            onCreated?.(lead);
          }}
          onOpenLead={(id) => {
            close();
            onOpenLead?.(id);
          }}
        />
      )}
    </Drawer>
  );
}
