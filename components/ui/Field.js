"use client";

import { createContext, useContext, useId } from "react";
import { cn } from "@/lib/cn";

const FieldCtx = createContext(null);

/** Control components read this to wire id / aria-describedby / aria-invalid automatically. */
export function useFieldProps(props = {}) {
  const f = useContext(FieldCtx);
  if (!f) return props;
  const describedBy = [props["aria-describedby"], f.hintId, f.errorId].filter(Boolean).join(" ") || undefined;
  return {
    ...props,
    id: props.id ?? f.id,
    required: props.required ?? f.required,
    "aria-describedby": describedBy,
    "aria-invalid": f.invalid || props["aria-invalid"] || undefined,
  };
}

/**
 * <Field label="Email" hint="…" error={errors.email} required><Input name="email" /></Field>
 * Label above, hint below, error replaces nothing (both can show). Errors are announced.
 */
export function Field({ label, hint, error, required, optionalLabel, className, children }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <FieldCtx value={{ id, hintId, errorId, invalid: Boolean(error), required }}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        {label && (
          <label htmlFor={id} className="flex items-baseline justify-between text-xs font-medium text-ink">
            <span>
              {label}
              {required && <span aria-hidden className="ml-0.5 text-danger">*</span>}
            </span>
            {!required && optionalLabel && <span className="font-normal text-ink-subtle">{optionalLabel}</span>}
          </label>
        )}
        {children}
        {hint && (
          <p id={hintId} className="text-xs text-ink-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    </FieldCtx>
  );
}

export const controlBase = cn(
  "w-full rounded-md border border-line-strong bg-surface text-sm text-ink placeholder:text-ink-subtle",
  "transition-[border-color,box-shadow] duration-150",
  "hover:border-ink-muted focus:border-primary focus:outline-none focus-visible:outline-none",
  "focus:shadow-[0_0_0_3px_rgb(45_50_40_/_0.12)]",
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-muted",
  "aria-invalid:border-danger aria-invalid:focus:shadow-[0_0_0_3px_rgb(166_61_47_/_0.15)]",
);
