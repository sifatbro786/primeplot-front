"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { controlBase, useFieldProps } from "./Field";

/** Native <select> — accessible and mobile-friendly by default; styled to match inputs. */
export function Select({ className, placeholder, children, ...props }) {
  const p = useFieldProps(props);
  return (
    <div className="relative">
      <select className={cn(controlBase, "h-10 cursor-pointer appearance-none pr-9 pl-3", className)} {...p}>
        {placeholder && (
          <option value="" disabled={p.required}>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-muted" />
    </div>
  );
}
