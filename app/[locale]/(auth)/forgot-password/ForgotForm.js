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
import { isIdentifier, isPhone } from "@/lib/auth/identifier";
import { errorMessage } from "@/lib/auth/session";

export function ForgotForm() {
  const t = useTranslations("auth.forgot");
  const tv = useTranslations("auth.validation");
  const te = useTranslations("errors");
  const [sentTo, setSentTo] = useState(null);

  const schema = z.object({ identifier: z.string().trim().min(1, tv("required")).max(254).refine(isIdentifier, tv("identifier")) });
  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { identifier: "" } });

  const send = async ({ identifier }) => {
    try {
      await api.post("/auth/password/forgot", { identifier });
      setSentTo(identifier); // same screen whether or not the account exists
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
        <AuthHeading title={isPhone(sentTo) ? t("sentTitleSms") : t("sentTitle")} subtitle={isPhone(sentTo) ? t("sentBodySms", { phone: sentTo }) : t("sentBody", { email: sentTo })} />
        <p className="text-xs text-ink-muted">{isPhone(sentTo) ? t("sentHintSms") : t("sentHint")}</p>
        <Button variant="secondary" className="mt-6" loading={isSubmitting} onClick={() => send({ identifier: getValues("identifier") })}>
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
        <Field label={t("identifier")} error={errors.identifier?.message}>
          <Input type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus {...register("identifier")} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          {t("submit")}
        </Button>
      </form>
      {back}
    </>
  );
}
