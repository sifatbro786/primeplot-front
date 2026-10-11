import { CircleAlert, Inbox } from "lucide-react";
import { cn } from "@/lib/cn";

/** Empty list / no results. Drafted frame, one clear next action. */
export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div className={cn("blueprint flex flex-col items-center rounded-lg border border-dashed border-line-strong/60 px-6 py-14 text-center", className)}>
      <span className="grid size-11 place-items-center rounded-md border border-line bg-surface">
        <Icon aria-hidden className="size-5 text-accent" strokeWidth={1.5} />
      </span>
      <h3 className="mt-4 text-sm font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Failed load. Shows the request id so support can find the server log line. */
export function ErrorState({ title, description, requestId, requestIdLabel = "Request ID", action, className }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center rounded-lg border border-danger/25 bg-danger-bg/50 px-6 py-12 text-center", className)}>
      <CircleAlert aria-hidden className="size-6 text-danger" strokeWidth={1.5} />
      <h3 className="mt-3 text-sm font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {requestId && (
        <p className="mt-3 font-mono text-[11px] text-ink-subtle">
          {requestIdLabel}: {requestId}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }) {
  return <span aria-hidden className={cn("block animate-pulse rounded-sm bg-surface-3", className)} />;
}
