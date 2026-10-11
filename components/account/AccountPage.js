"use client";

import { Laptop, Smartphone } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { PasswordInput, PasswordRules } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { Tag } from "@/components/ui/Tag";
import { toast } from "@/components/ui/Toast";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { errorMessage, ME_KEY, useSession } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";

const SESSIONS_KEY = ["auth", "sessions"];

function Panel({ title, description, children }) {
  return (
    <section className="grid gap-6 border-t border-line py-10 first:border-t-0 first:pt-0 lg:grid-cols-[260px_1fr]">
      <header>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>}
      </header>
      <div className="max-w-xl">{children}</div>
    </section>
  );
}

/** "Chrome on Windows" from a user-agent string — good enough for a session list. */
function describeAgent(ua = "") {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : null;
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : null;
  return { label: [browser, os].filter(Boolean).join(" · ") || null, mobile: /Mobi|Android|iPhone/.test(ua) };
}

function ProfileForm({ user }) {
  const t = useTranslations("account.profile");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("errors");
  const qc = useQueryClient();
  const schema = z.object({
    name: z.string().trim().min(2, tv("min", { n: 2 })).max(120),
    phone: z.string().trim().max(20),
    locale: z.enum(["bn", "en"]),
  });
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { name: user.name, phone: user.phone ?? "", locale: user.locale } });

  const onSubmit = async (v) => {
    try {
      const { user: updated } = await api.patch("/auth/me", { name: v.name, phone: v.phone || null, locale: v.locale });
      qc.setQueryData(ME_KEY, (old) => (old ? { ...old, user: updated } : old));
      reset({ name: updated.name, phone: updated.phone ?? "", locale: updated.locale });
      toast.success(t("saved"));
    } catch (err) {
      if (err?.code === "INVALID_PHONE") return setError("phone", { message: t("invalidPhone") });
      toast.error(errorMessage(te, err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <Field label={t("email")} hint={t("emailHint")}>
        <Input value={user.email} disabled readOnly />
      </Field>
      <Field label={t("name")} error={errors.name?.message}>
        <Input autoComplete="name" {...register("name")} />
      </Field>
      <Field label={t("phone")} hint={t("phoneHint")} error={errors.phone?.message}>
        <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" {...register("phone")} />
      </Field>
      <Field label={t("locale")} hint={t("localeHint")}>
        <Select {...register("locale")}>
          <option value="bn">বাংলা</option>
          <option value="en">English</option>
        </Select>
      </Field>
      <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
        {t("save")}
      </Button>
    </form>
  );
}

function PasswordForm() {
  const t = useTranslations("account.password");
  const ta = useTranslations("auth");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("errors");
  const qc = useQueryClient();
  const schema = z
    .object({
      currentPassword: z.string().min(1, tv("required")),
      newPassword: z.string().min(10, tv("min", { n: 10 })).max(128, tv("max", { n: 128 })),
      confirm: z.string(),
    })
    .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: tv("mismatch") });
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { currentPassword: "", newPassword: "", confirm: "" } });
  const [newPassword, confirm] = useWatch({ control, name: ["newPassword", "confirm"] });

  const onSubmit = async ({ currentPassword, newPassword }) => {
    try {
      await api.post("/auth/password/change", { currentPassword, newPassword });
      reset();
      qc.invalidateQueries({ queryKey: SESSIONS_KEY });
      toast.success(t("changed"));
    } catch (err) {
      if (err?.code === "INVALID_CURRENT_PASSWORD") return setError("currentPassword", { message: t("wrongCurrent") });
      if (err?.code === "PASSWORD_UNCHANGED") return setError("newPassword", { message: t("unchanged") });
      if (err?.code === "VALIDATION_ERROR") return setError("newPassword", { message: ta("rules.weak") });
      toast.error(errorMessage(te, err));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <Field label={t("current")} error={errors.currentPassword?.message}>
        <PasswordInput autoComplete="current-password" {...register("currentPassword")} />
      </Field>
      <Field label={t("new")} error={errors.newPassword?.message}>
        <PasswordInput autoComplete="new-password" {...register("newPassword")} />
      </Field>
      <Field label={t("confirm")} error={errors.confirm?.message}>
        <PasswordInput autoComplete="new-password" {...register("confirm")} />
      </Field>
      <PasswordRules value={newPassword} confirm={confirm} />
      <Button type="submit" loading={isSubmitting}>
        {t("submit")}
      </Button>
    </form>
  );
}

function Sessions() {
  const t = useTranslations("account.sessions");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const qc = useQueryClient();
  const router = useRouter();
  const q = useQuery({ queryKey: SESSIONS_KEY, queryFn: () => api.get("/auth/sessions") });

  const revoke = useMutation({
    mutationFn: (id) => api.delete(`/auth/sessions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SESSIONS_KEY });
      toast.success(t("revoked"));
    },
    onError: (err) => toast.error(errorMessage(te, err)),
  });
  const everywhere = useMutation({
    mutationFn: () => api.post("/auth/logout-all"),
    onSuccess: () => {
      qc.clear();
      router.replace("/login");
    },
    onError: (err) => toast.error(errorMessage(te, err)),
  });

  if (q.isPending) return <Skeleton className="h-24 w-full" />;
  if (q.isError) return <ErrorState title={t("loadFailed")} description={errorMessage(te, q.error)} requestId={q.error?.requestId} requestIdLabel={tc("requestId")} />;

  return (
    <>
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {q.data.map((s) => {
          const agent = describeAgent(s.userAgent);
          const Icon = agent.mobile ? Smartphone : Laptop;
          return (
            <li key={s.id} className="flex items-center gap-4 px-4 py-3.5">
              <Icon aria-hidden className="size-5 shrink-0 text-ink-subtle" strokeWidth={1.5} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="truncate">{agent.label ?? t("unknownDevice")}</span>
                  {s.current && <Tag tone="accent">{t("thisDevice")}</Tag>}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-ink-muted">
                  {s.ip ?? "—"} · {t("lastActive", { when: formatDate(s.lastUsedAt, locale, "datetime") })}
                </p>
              </div>
              {!s.current && (
                <Button size="sm" variant="ghost" loading={revoke.isPending && revoke.variables === s.id} onClick={() => revoke.mutate(s.id)}>
                  {t("revoke")}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <Button variant="secondary" className="mt-5" loading={everywhere.isPending} onClick={() => everywhere.mutate()}>
        {t("logoutAll")}
      </Button>
    </>
  );
}

/** Shared by /dashboard/account and /portal/account. */
export function AccountPage() {
  const t = useTranslations("account");
  const { user, isPending } = useSession();

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-10">
        <span className="eyebrow">{t("eyebrow")}</span>
        <h2 className="mt-4 font-display text-4xl">{t("title")}</h2>
      </header>
      <Panel title={t("profile.title")} description={t("profile.description")}>
        {isPending || !user ? <Skeleton className="h-64 w-full" /> : <ProfileForm user={user} />}
      </Panel>
      <Panel title={t("password.title")} description={t("password.description")}>
        <PasswordForm />
      </Panel>
      <Panel title={t("sessions.title")} description={t("sessions.description")}>
        <Sessions />
      </Panel>
    </div>
  );
}
