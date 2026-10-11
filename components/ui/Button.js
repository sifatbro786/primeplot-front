import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

const VARIANTS = {
  primary: "bg-primary text-primary-ink hover:bg-primary-hover border border-primary",
  accent: "bg-accent text-accent-ink hover:bg-accent-hover border border-accent",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-surface-2",
  ghost: "bg-transparent text-ink border border-transparent hover:bg-surface-2",
  danger: "bg-danger text-white border border-danger hover:brightness-95",
  link: "bg-transparent text-accent border-0 underline-offset-4 hover:underline px-0! h-auto!",
};

const SIZES = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-sm gap-2.5 tracking-wide",
  icon: "size-10 p-0",
};

/**
 * <Button variant size loading as={Link} …>
 * - `loading` keeps the width (label stays, spinner overlays) and sets aria-busy + disabled.
 * - `as` renders another element (e.g. the locale-aware Link) with button styling.
 */
export function Button({
  as: Comp = "button",
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  children,
  type,
  ...props
}) {
  const isButton = Comp === "button";
  return (
    <Comp
      type={isButton ? (type ?? "button") : undefined}
      disabled={isButton ? disabled || loading : undefined}
      aria-disabled={!isButton && (disabled || loading) ? true : undefined}
      aria-busy={loading || undefined}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap select-none",
        "transition-[background-color,border-color,color,box-shadow] duration-150 ease-(--ease-out-quint)",
        "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      <span className={cn("inline-flex items-center gap-[inherit]", loading && "invisible")}>{children}</span>
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner />
        </span>
      )}
    </Comp>
  );
}
