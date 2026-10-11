import { cn } from "@/lib/cn";

/** Table primitives. Data tables (sorting, columns) build on these with TanStack Table later. */
export function Table({ className, children, ...props }) {
  return (
    <div className="relative overflow-x-auto rounded-lg border border-line bg-surface">
      <table className={cn("w-full border-collapse text-left text-sm", className)} {...props}>
        {children}
      </table>
    </div>
  );
}
export const THead = ({ className, ...p }) => <thead className={cn("bg-surface-2", className)} {...p} />;
export const TBody = ({ className, ...p }) => <tbody className={cn("divide-y divide-line", className)} {...p} />;
export const TR = ({ className, ...p }) => <tr className={cn("transition-colors hover:bg-canvas", className)} {...p} />;
export function TH({ className, align = "left", ...p }) {
  return (
    <th
      scope="col"
      className={cn(
        "h-10 border-b border-line px-4 text-[11px] font-semibold tracking-[0.08em] whitespace-nowrap text-ink-muted uppercase",
        align === "right" && "text-right",
        className,
      )}
      {...p}
    />
  );
}
export function TD({ className, align = "left", numeric, ...p }) {
  return (
    <td
      className={cn(
        "h-12 px-4 align-middle",
        (align === "right" || numeric) && "text-right",
        numeric && "font-mono text-[13px] tabular-nums",
        className,
      )}
      {...p}
    />
  );
}
