import { cn } from "@/lib/cn";

const TONES = {
  neutral: "bg-surface-2 text-ink-muted border-line",
  accent: "bg-accent-soft text-accent border-transparent",
  success: "bg-success-bg text-success border-transparent",
  warning: "bg-warning-bg text-warning border-transparent",
  danger: "bg-danger-bg text-danger border-transparent",
  info: "bg-info-bg text-info border-transparent",
  outline: "bg-transparent text-ink border-line-strong",
};

/** Small square-cornered label: "Premium", "Ready", "Handover 2027". */
export function Tag({ tone = "neutral", className, children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-sm border px-2 text-[11px] font-medium tracking-wide whitespace-nowrap",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
