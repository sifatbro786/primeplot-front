"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

export function Checkbox({ label, description, className, id, ...props }) {
  const auto = useId();
  const cid = id ?? auto;
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <input
        id={cid}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded-sm border-line-strong accent-primary"
        aria-describedby={description ? `${cid}-d` : undefined}
        {...props}
      />
      {(label || description) && (
        <label htmlFor={cid} className="cursor-pointer text-sm leading-tight">
          {label}
          {description && (
            <span id={`${cid}-d`} className="mt-0.5 block text-xs text-ink-muted">
              {description}
            </span>
          )}
        </label>
      )}
    </div>
  );
}
