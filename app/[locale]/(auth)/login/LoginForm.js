"use client";

import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { AuthHeading, FormAlert, PasswordInput } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { homeFor, safeNext } from "@/lib/auth/paths";
import { isIdentifier } from "@/lib/auth/identifier";
import { errorMessage, ME_KEY } from "@/lib/auth/session";

const NOTICES = { expired: "info", reset: "success", setup: "success" };

export function LoginForm() {
  const t = useTranslations("auth.login");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("errors");
  const router = useRouter();
  const qc = useQueryClient();
  const params = useSearchParams();
  const notice = params.get("reason");

  const schema = z.object({
    // E-mail (staff, most clients) or mobile number (B5: clients may have no e-mail).
    identifier: z.string().trim().min(1, tv("required")).max(254).refine(isIdentifier, tv("identifier")),
    password: z.string().min(1, tv("required")),
    remember: z.boolean(),
  });

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { identifier: "", password: "", remember: false } });

  const onSubmit = async (values) => {
    try {
      const { user } = await api.post("/auth/login", values);
      qc.removeQueries({ queryKey: ME_KEY });
      router.replace(safeNext(params.get("next"), user.role) ?? homeFor(user.role));
    } catch (err) {
      let message;
      switch (err?.code) {
        case "INVALID_CREDENTIALS":
          message = t("invalid");
          break;
        case "ACCOUNT_LOCKED":
          message = t("locked", { minutes: Math.max(1, Math.ceil((err.details?.retryAfterSec ?? 900) / 60)) });
          break;
        case "ACCOUNT_DISABLED":
          message = t("disabled");
          break;
        default:
          message = errorMessage(te, err);
      }
      setError("root", { message });
    }
  };

  return (
    <>
      <AuthHeading eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />

      {NOTICES[notice] && !errors.root && <FormAlert tone={NOTICES[notice]}>{t(`notice.${notice}`)}</FormAlert>}
      <FormAlert>{errors.root?.message}</FormAlert>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <Field label={t("identifier")} hint={t("identifierHint")} error={errors.identifier?.message}>
          <Input type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus {...register("identifier")} />
        </Field>
        <Field label={t("password")} error={errors.password?.message}>
          <PasswordInput autoComplete="current-password" {...register("password")} />
        </Field>
        <div className="flex items-center justify-between gap-4">
          <Checkbox label={t("remember")} {...register("remember")} />
          <Link href="/forgot-password" className="text-xs font-medium text-accent hover:underline">
            {t("forgot")}
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          {t("submit")}
        </Button>
      </form>
    </>
  );
}
