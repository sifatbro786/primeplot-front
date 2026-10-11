"use client";

import { useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

export function AuthHeading({ eyebrow, title, subtitle }) {
  return (
    <div className="mb-8">
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1 className="mt-4 font-display text-4xl leading-tight">{title}</h1>
      {subtitle && <p className="mt-3 text-sm leading-relaxed text-ink-muted">{subtitle}</p>}
    </div>
  );
}

/** Password field with a show/hide toggle (keeps the same Field wiring as <Input>). */
export function PasswordInput(props) {
  const t = useTranslations("auth");
  const [show, setShow] = useState(false);
  return (
    <Input
      type={show ? "text" : "password"}
      autoCapitalize="none"
      spellCheck={false}
      trailing={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="rounded-sm p-1.5 text-ink-subtle hover:text-ink"
          aria-label={show ? t("hidePassword") : t("showPassword")}
          aria-pressed={show}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
      {...props}
    />
  );
}

/** Live checklist for the backend policy (10–128 chars; the server checks the rest). */
export function PasswordRules({ value = "", confirm }) {
  const t = useTranslations("auth.rules");
  const rules = [
    ["length", value.length >= 10],
    ...(confirm !== undefined ? [["match", value.length > 0 && value === confirm]] : []),
  ];
  return (
    <ul className="mt-1 space-y-1 text-xs">
      {rules.map(([key, ok]) => (
        <li key={key} className={cn("flex items-center gap-2", ok ? "text-success" : "text-ink-muted")}>
          <span className={cn("grid size-3.5 place-items-center rounded-[2px] border", ok ? "border-success bg-success text-white" : "border-line-strong")}>
            {ok && <Check className="size-2.5" strokeWidth={3} />}
          </span>
          {t(key)}
        </li>
      ))}
    </ul>
  );
}

/** Inline alert above a form (errors from the API). */
export function FormAlert({ tone = "danger", children }) {
  if (!children) return null;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "mb-5 rounded-md border px-3.5 py-3 text-sm leading-snug",
        tone === "danger" && "border-danger/25 bg-danger-bg text-danger",
        tone === "info" && "border-info/20 bg-info-bg text-info",
        tone === "success" && "border-success/25 bg-success-bg text-success",
      )}
    >
      {children}
    </div>
  );
}
