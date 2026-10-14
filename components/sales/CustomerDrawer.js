"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useSalesError } from "@/lib/sales/errors";
import { salesKeys } from "@/lib/sales/queries";
import { DocumentsField, PhotoField, discardMedia } from "./PrivateFiles";

const TEXT = [
  "name", "nameBn", "fatherName", "motherName", "spouseName", "dateOfBirth", "nationality", "nid", "passportNo", "tin",
  "phone", "altPhone", "email", "presentAddress", "permanentAddress", "foreignAddress", "occupation", "organization", "notes",
];

const toValues = (c = {}) => ({
  ...Object.fromEntries(TEXT.map((k) => [k, c[k] ?? ""])),
  nationality: c.nationality ?? (c.id ? "" : "Bangladeshi"),
  locale: c.locale ?? "",
  photoMediaId: c.photoMediaId ?? null,
  documentMediaIds: c.documentMediaIds ?? [],
});

/**
 * Create / edit a customer (buyer profile). `preset` pre-fills a new one (e.g. from a lead:
 * { name, phone, email, leadId }). onSaved(customer) after a successful save.
 */
export function CustomerDrawer({ open, customer, preset, onClose, onSaved }) {
  const t = useTranslations("sales.customers");
  return (
    <Drawer open={open} onClose={onClose} title={customer ? t("editTitle") : t("newTitle")} description={customer ? customer.customerNo : t("newDescription")} width="lg">
      {open && <CustomerForm key={customer?.id ?? "new"} customer={customer} preset={preset} onClose={onClose} onSaved={onSaved} />}
    </Drawer>
  );
}

function CustomerForm({ customer, preset, onClose, onSaved }) {
  const t = useTranslations("sales.customers");
  const tv = useTranslations("sales.validation");
  const tc = useTranslations("common");
  const locale = useLocale();
  const salesError = useSalesError();
  const qc = useQueryClient();
  const [uploaded, setUploaded] = useState([]); // ids uploaded in this form (discarded if not saved)
  const [busy, setBusy] = useState(false);

  const opt = (max) => z.string().trim().max(max);
  const schema = z.object({
    name: z.string().trim().min(2, tv("min2")).max(160),
    nameBn: opt(160),
    fatherName: opt(160),
    motherName: opt(160),
    spouseName: opt(160),
    dateOfBirth: z.string(),
    nationality: opt(60),
    nid: z.union([z.literal(""), z.string().trim().regex(/^(\d{10}|\d{13}|\d{17})$/, tv("nid"))]),
    passportNo: z.union([z.literal(""), z.string().trim().regex(/^[A-Za-z0-9]{6,12}$/, tv("passport"))]),
    tin: z.union([z.literal(""), z.string().trim().regex(/^\d{12}$/, tv("tin"))]),
    phone: z.string().trim().min(6, tv("phone")).max(30),
    altPhone: opt(30),
    email: z.union([z.literal(""), z.string().trim().pipe(z.email(tv("email")))]),
    presentAddress: opt(500),
    permanentAddress: opt(500),
    foreignAddress: opt(500),
    occupation: opt(120),
    organization: opt(160),
    notes: opt(1000),
    locale: z.enum(["", "bn", "en"]),
    photoMediaId: z.string().nullable(),
    documentMediaIds: z.array(z.string()),
  });

  const form = useForm({ resolver: zodResolver(schema), defaultValues: toValues(customer ?? preset ?? {}) });
  const { register, handleSubmit, setValue, setError, control, formState } = form;
  const { errors, dirtyFields } = formState;
  const photo = useWatch({ control, name: "photoMediaId" });
  const docs = useWatch({ control, name: "documentMediaIds" });

  const close = () => {
    // Files uploaded in this form but not saved with the customer are thrown away.
    const keep = new Set([photo, ...docs, customer?.photoMediaId, ...(customer?.documentMediaIds ?? [])].filter(Boolean));
    discardMedia(uploaded.filter((id) => !keep.has(id)));
    onClose();
  };

  const onSubmit = async (v) => {
    const body = {};
    for (const k of TEXT) {
      if (customer && !dirtyFields[k]) continue;
      const val = v[k].trim();
      if (["name", "phone"].includes(k)) body[k] = val;
      else if (val || customer) body[k] = val || null;
    }
    if (!customer || dirtyFields.locale) body.locale = v.locale || null;
    if (!customer || dirtyFields.photoMediaId) body.photoMediaId = v.photoMediaId;
    if (!customer || dirtyFields.documentMediaIds) body.documentMediaIds = v.documentMediaIds;
    if (!customer && preset?.leadId) body.leadId = preset.leadId;
    setBusy(true);
    try {
      const saved = customer
        ? await api.patch(`/customers/${customer.id}`, { version: customer.version, ...body })
        : await api.post("/customers", body);
      setUploaded([]);
      qc.setQueryData(salesKeys.customer(saved.id), saved);
      qc.invalidateQueries({ queryKey: ["customers", "list"] });
      toast.success(customer ? t("saved") : t("created", { no: saved.customerNo }));
      onSaved?.(saved);
    } catch (err) {
      const code = err?.code;
      if (code === "DUPLICATE") setError("nid", { message: t("duplicateNid") });
      else if (code === "INVALID_PHONE") setError(err.details?.[0]?.path === "altPhone" ? "altPhone" : "phone", { message: tv("phone") });
      else if (code === "VALIDATION_ERROR" && Object.keys(err.fieldErrors).length) {
        for (const [path, message] of Object.entries(err.fieldErrors)) setError(path.split(".")[0], { message });
      } else setError("root", { message: salesError(err, locale) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-8">
      <FormAlert>{errors.root?.message}</FormAlert>

      <fieldset className="space-y-5">
        <legend className="eyebrow mb-4">{t("sections.identity")}</legend>
        <PhotoField
          mediaId={photo}
          onChange={(id) => setValue("photoMediaId", id, { shouldDirty: true })}
          onUploaded={(id) => setUploaded((u) => [...u, id])}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("fields.name")} error={errors.name?.message} required>
            <Input {...register("name")} autoComplete="off" />
          </Field>
          <Field label={t("fields.nameBn")} error={errors.nameBn?.message}>
            <Input lang="bn" {...register("nameBn")} autoComplete="off" />
          </Field>
          <Field label={t("fields.fatherName")} error={errors.fatherName?.message}>
            <Input {...register("fatherName")} />
          </Field>
          <Field label={t("fields.motherName")} error={errors.motherName?.message}>
            <Input {...register("motherName")} />
          </Field>
          <Field label={t("fields.spouseName")} error={errors.spouseName?.message}>
            <Input {...register("spouseName")} />
          </Field>
          <Field label={t("fields.dateOfBirth")} error={errors.dateOfBirth?.message}>
            <Input type="date" {...register("dateOfBirth")} />
          </Field>
          <Field label={t("fields.nid")} hint={t("hints.nid")} error={errors.nid?.message}>
            <Input inputMode="numeric" className="font-mono text-[13px]" {...register("nid")} />
          </Field>
          <Field label={t("fields.passportNo")} error={errors.passportNo?.message}>
            <Input className="font-mono text-[13px] uppercase" {...register("passportNo")} />
          </Field>
          <Field label={t("fields.tin")} error={errors.tin?.message}>
            <Input inputMode="numeric" className="font-mono text-[13px]" {...register("tin")} />
          </Field>
          <Field label={t("fields.nationality")} error={errors.nationality?.message}>
            <Input {...register("nationality")} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="eyebrow mb-4">{t("sections.contact")}</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("fields.phone")} hint={t("hints.phone")} error={errors.phone?.message} required>
            <Input type="tel" inputMode="tel" className="font-mono text-[13px]" placeholder="01XXXXXXXXX" {...register("phone")} />
          </Field>
          <Field label={t("fields.altPhone")} error={errors.altPhone?.message}>
            <Input type="tel" inputMode="tel" className="font-mono text-[13px]" {...register("altPhone")} />
          </Field>
          <Field label={t("fields.email")} hint={t("hints.email")} error={errors.email?.message}>
            <Input type="email" {...register("email")} />
          </Field>
          <Field label={t("fields.locale")} hint={t("hints.locale")}>
            <Select {...register("locale")}>
              <option value="">{t("localeDefault")}</option>
              <option value="bn">বাংলা</option>
              <option value="en">English</option>
            </Select>
          </Field>
        </div>
        <Field label={t("fields.presentAddress")} error={errors.presentAddress?.message}>
          <Textarea rows={2} {...register("presentAddress")} />
        </Field>
        <Field label={t("fields.permanentAddress")} error={errors.permanentAddress?.message}>
          <Textarea rows={2} {...register("permanentAddress")} />
        </Field>
        <Field label={t("fields.foreignAddress")} hint={t("hints.foreignAddress")} error={errors.foreignAddress?.message}>
          <Textarea rows={2} {...register("foreignAddress")} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("fields.occupation")} error={errors.occupation?.message}>
            <Input {...register("occupation")} />
          </Field>
          <Field label={t("fields.organization")} error={errors.organization?.message}>
            <Input {...register("organization")} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-5">
        <legend className="eyebrow mb-4">{t("sections.papers")}</legend>
        <DocumentsField
          ids={docs}
          onChange={(ids) => setValue("documentMediaIds", ids, { shouldDirty: true })}
          onUploaded={(ids) => setUploaded((u) => [...u, ...ids])}
        />
        <Field label={t("fields.notes")} error={errors.notes?.message}>
          <Textarea rows={3} {...register("notes")} />
        </Field>
      </fieldset>

      <div className="sticky bottom-0 -mx-6 -mb-5 flex justify-end gap-2 border-t border-line bg-surface px-6 py-4">
        <Button variant="ghost" onClick={close}>
          {tc("cancel")}
        </Button>
        <Button type="submit" loading={busy}>
          {customer ? tc("save") : t("create")}
        </Button>
      </div>
    </form>
  );
}
