"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/auth/session";

const ROLES = ["admin", "sales_manager", "sales_executive", "client"];
const FORM_ID = "user-form";

function UserForm({ mode, user, meId, onDone, onBusy }) {
  const t = useTranslations("team");
  const tr = useTranslations("roles");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("errors");
  const qc = useQueryClient();
  const isSelf = mode === "edit" && user.id === meId;

  const schema = z.object({
    name: z.string().trim().min(2, tv("min", { n: 2 })).max(120),
    email: mode === "invite" ? z.string().trim().min(1, tv("required")).pipe(z.email(tv("email"))) : z.string().optional(),
    phone: z.string().trim().max(20),
    role: z.enum(ROLES),
    status: z.enum(["active", "invited", "disabled"]).optional(),
    locale: z.enum(["bn", "en"]),
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues:
      mode === "invite"
        ? { name: "", email: "", phone: "", role: "sales_executive", locale: "bn" }
        : { name: user.name, email: user.email, phone: user.phone ?? "", role: user.role, status: user.status, locale: user.locale },
  });

  const onSubmit = async (v) => {
    onBusy(true);
    try {
      if (mode === "invite") {
        await api.post("/users", { name: v.name, email: v.email, role: v.role, locale: v.locale, ...(v.phone && { phone: v.phone }) });
        toast.success(t("invited", { email: v.email }));
      } else {
        // Send only what changed — role/status changes sign the user out everywhere.
        const patch = {};
        if (dirtyFields.name) patch.name = v.name;
        if (dirtyFields.phone) patch.phone = v.phone || null;
        if (dirtyFields.locale) patch.locale = v.locale;
        if (dirtyFields.role) patch.role = v.role;
        if (dirtyFields.status && v.status !== "invited") patch.status = v.status;
        if (Object.keys(patch).length === 0) return onDone();
        await api.patch(`/users/${user.id}`, patch);
        toast.success(t("updated"));
      }
      qc.invalidateQueries({ queryKey: ["users"] });
      onDone();
    } catch (err) {
      switch (err?.code) {
        case "DUPLICATE":
          return setError("email", { message: t("errors.duplicate") });
        case "INVALID_PHONE":
          return setError("phone", { message: t("errors.phone") });
        case "SELF_CHANGE":
        case "LAST_ADMIN":
        case "INVITE_PENDING":
          return setError("root", { message: t(`errors.${err.code}`) });
        default:
          setError("root", { message: errorMessage(te, err) });
      }
    } finally {
      onBusy(false);
    }
  };

  return (
    <form id={FORM_ID} onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <FormAlert>{errors.root?.message}</FormAlert>
      <Field label={t("name")} error={errors.name?.message} required>
        <Input autoComplete="off" {...register("name")} />
      </Field>
      <Field label={t("email")} error={errors.email?.message} required={mode === "invite"} hint={mode === "edit" ? t("emailLocked") : t("emailHint")}>
        <Input type="email" disabled={mode === "edit"} autoComplete="off" {...register("email")} />
      </Field>
      <Field label={t("phone")} error={errors.phone?.message}>
        <Input type="tel" inputMode="tel" placeholder="01XXXXXXXXX" {...register("phone")} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("role")} hint={isSelf ? t("selfHint") : undefined}>
          <Select disabled={isSelf} {...register("role")}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {tr(r)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("language")}>
          <Select {...register("locale")}>
            <option value="bn">বাংলা</option>
            <option value="en">English</option>
          </Select>
        </Field>
      </div>
      {mode === "edit" && user.status !== "invited" && (
        <Field label={t("status")} hint={t("statusHint")}>
          <Select disabled={isSelf} {...register("status")}>
            <option value="active">{t("statuses.active")}</option>
            <option value="disabled">{t("statuses.disabled")}</option>
          </Select>
        </Field>
      )}
      <p className="border-t border-line pt-4 text-xs leading-relaxed text-ink-muted">{t(`roleHelp.${mode === "invite" ? "invite" : "edit"}`)}</p>
    </form>
  );
}

/** Invite / edit a team member. `state` = null | { mode: 'invite' } | { mode: 'edit', user }. */
export function UserDrawer({ state, onClose, meId }) {
  const t = useTranslations("team");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const user = state?.user;

  const resend = async () => {
    setResending(true);
    try {
      await api.post(`/users/${user.id}/resend-invite`);
      toast.success(t("invited", { email: user.email }));
    } catch (err) {
      toast.error(err?.code === "ALREADY_ACTIVE" ? t("errors.ALREADY_ACTIVE") : errorMessage(te, err));
    } finally {
      setResending(false);
    }
  };

  return (
    <Drawer
      open={Boolean(state)}
      onClose={onClose}
      title={state?.mode === "invite" ? t("inviteTitle") : t("editTitle")}
      description={state?.mode === "invite" ? t("inviteDescription") : user?.email}
      footer={
        <>
          {user?.status === "invited" && (
            <Button variant="ghost" className="mr-auto" loading={resending} onClick={resend}>
              <Mail aria-hidden className="size-4" />
              {t("resend")}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form={FORM_ID} loading={busy}>
            {state?.mode === "invite" ? t("sendInvite") : tc("save")}
          </Button>
        </>
      }
    >
      {state && <UserForm key={user?.id ?? "invite"} mode={state.mode} user={user} meId={meId} onDone={onClose} onBusy={setBusy} />}
    </Drawer>
  );
}
