"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * Small exclusive choice (2–4 options) as a native radio group: keyboard arrows, form reset and
 * screen readers work without extra code.
 * <Segmented name="kind" value={v} onChange={setV} options={[{ value, label, hint? }]} />
 */
export function Segmented({ name, value, onChange, options, disabled, size = "md", className, "aria-label": ariaLabel }) {
  const auto = useId();
  const group = name ?? auto;
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex rounded-md border border-line-strong bg-surface p-0.5", className)}>
      {options.map((o) => {
        const id = `${group}-${o.value}`;
        const checked = value === o.value;
        return (
          <label
            key={o.value}
            htmlFor={id}
            className={cn(
              "relative flex cursor-pointer items-center justify-center rounded-[3px] font-medium whitespace-nowrap transition-colors",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
              checked ? "bg-primary text-primary-ink" : "text-ink-muted hover:bg-surface-2 hover:text-ink",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <input
              id={id}
              type="radio"
              name={group}
              value={o.value}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span className="peer-focus-visible:underline peer-focus-visible:underline-offset-4">{o.label}</span>
          </label>
        );
      })}
    </div>
  );
}
