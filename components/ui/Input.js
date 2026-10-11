"use client";

import { cn } from "@/lib/cn";
import { controlBase, useFieldProps } from "./Field";

export function Input({ className, leading, trailing, ...props }) {
  const p = useFieldProps(props);
  if (!leading && !trailing) return <input className={cn(controlBase, "h-10 px-3", className)} {...p} />;
  return (
    <div className="relative">
      {leading && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-subtle">{leading}</span>
      )}
      <input className={cn(controlBase, "h-10", leading ? "pl-9" : "pl-3", trailing ? "pr-10" : "pr-3", className)} {...p} />
      {trailing && <span className="absolute inset-y-0 right-2 flex items-center">{trailing}</span>}
    </div>
  );
}

export function Textarea({ className, rows = 4, ...props }) {
  const p = useFieldProps(props);
  return <textarea rows={rows} className={cn(controlBase, "resize-y px-3 py-2.5 leading-relaxed", className)} {...p} />;
}
