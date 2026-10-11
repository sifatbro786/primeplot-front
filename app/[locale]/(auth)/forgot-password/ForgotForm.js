"use client";

import { useState } from "react";
import { ArrowLeft, MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { AuthHeading, FormAlert } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/auth/session";

export function ForgotForm() {
  const t = useTranslations("auth.forgot");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("errors");
  const [sentTo, setSentTo] = useState(null);

  const schema = z.object({ email: z.string().trim().min(1, tv("required")).pipe(z.email(tv("email"))) });
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  const send = async ({ email }) => {
    try {
      await api.post("/auth/password/forgot", { email });
      setSentTo(email); // same screen whether or not the account exists
    } catch (err) {
      setError("root", { message: errorMessage(te, err) });
    }
  };

  const back = (
    <Link href="/login" className="mt-8 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
      <ArrowLeft aria-hidden className="size-3.5" />
      {t("back")}
    </Link>
  );

  if (sentTo) {
    return (
      <>
        <span className="grid size-11 place-items-center rounded-md border border-line bg-surface">
          <MailCheck aria-hidden className="size-5 text-accent" strokeWidth={1.5} />
        </span>
        <AuthHeading title={t("sentTitle")} subtitle={t("sentBody", { email: sentTo })} />
        <p className="text-xs text-ink-muted">{t("sentHint")}</p>
        <Button variant="secondary" className="mt-6" loading={isSubmitting} onClick={() => send({ email: getValues("email") })}>
          {t("resend")}
        </Button>
        <div>{back}</div>
      </>
    );
  }

  return (
    <>
      <AuthHeading eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} />
      <FormAlert>{errors.root?.message}</FormAlert>
      <form onSubmit={handleSubmit(send)} noValidate className="space-y-5">
        <Field label={t("email")} error={errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" autoFocus {...register("email")} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          {t("submit")}
        </Button>
      </form>
      {back}
    </>
  );
}
