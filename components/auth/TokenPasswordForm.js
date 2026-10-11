"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Link2Off } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { AuthHeading, FormAlert, PasswordInput, PasswordRules } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/States";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/auth/session";

const CONFIG = {
  password_reset: { ns: "auth.reset", endpoint: "/auth/password/reset", done: "reset" },
  account_setup: { ns: "auth.setup", endpoint: "/auth/setup-account", done: "setup" },
};

/**
 * Shared by /reset-password and /setup-account. The emailed token is read once, then removed
 * from the address bar (history.replaceState) so it can't leak via history, screenshots or the
 * Referer header (the page also sets referrer: no-referrer).
 */
export function TokenPasswordForm({ purpose }) {
  const cfg = CONFIG[purpose];
  const t = useTranslations(cfg.ns);
  const ta = useTranslations("auth");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const params = useSearchParams();
  const [token] = useState(() => params.get("token") ?? "");
  const [dead, setDead] = useState(false);

  useEffect(() => {
    if (params.get("token")) window.history.replaceState(null, "", window.location.pathname);
  }, [params]);

  const inspect = useQuery({
    queryKey: ["auth", "token", purpose, token],
    queryFn: () => api.post("/auth/token/inspect", { token, purpose }),
    enabled: token.length >= 20 && token.length <= 100,
    staleTime: Infinity,
    retry: false,
  });

  const schema = z
    .object({
      password: z.string().min(10, tv("min", { n: 10 })).max(128, tv("max", { n: 128 })),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: tv("mismatch") });

  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });

  // useWatch (not watch()) keeps React Compiler memoization intact.
  const [password, confirm] = useWatch({ control, name: ["password", "confirm"] });

  const onSubmit = async ({ password }) => {
    try {
      await api.post(cfg.endpoint, { token, password });
      router.replace({ pathname: "/login", query: { reason: cfg.done } });
    } catch (err) {
      if (err?.code === "INVALID_TOKEN") return setDead(true);
      if (err?.code === "VALIDATION_ERROR") return setError("password", { message: ta("rules.weak") });
      setError("root", { message: errorMessage(te, err) });
    }
  };

  const malformed = token.length < 20 || token.length > 100;
  const invalid = malformed || dead || inspect.data?.valid === false || inspect.isError;

  if (invalid) {
    return (
      <>
        <span className="grid size-11 place-items-center rounded-md border border-line bg-surface">
          <Link2Off aria-hidden className="size-5 text-danger" strokeWidth={1.5} />
        </span>
        <AuthHeading title={t("invalidTitle")} subtitle={t("invalidBody")} />
        {purpose === "password_reset" ? (
          <Button as={Link} href="/forgot-password">
            {t("requestNew")}
          </Button>
        ) : null}
        <Link href="/login" className="mt-8 flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
          <ArrowLeft aria-hidden className="size-3.5" />
          {ta("backToLogin")}
        </Link>
      </>
    );
  }


  return (
    <>
      <AuthHeading eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
      <div className="mb-6 flex h-10 items-center rounded-md border border-line bg-surface-2 px-3 font-mono text-sm text-ink-muted">
        {inspect.isPending ? <Skeleton className="h-3 w-40" /> : inspect.data?.email}
      </div>
      <FormAlert>{errors.root?.message}</FormAlert>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Field label={t("password")} error={errors.password?.message}>
          <PasswordInput autoComplete="new-password" autoFocus {...register("password")} />
        </Field>
        <Field label={t("confirm")} error={errors.confirm?.message}>
          <PasswordInput autoComplete="new-password" {...register("confirm")} />
        </Field>
        <PasswordRules value={password} confirm={confirm} />
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} disabled={inspect.isPending}>
          {t("submit")}
        </Button>
      </form>
    </>
  );
}
