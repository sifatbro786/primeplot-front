"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/**
 * Centred modal on the native <dialog> (focus trap, Esc, top layer from the browser).
 * <Dialog open title description onClose footer>…</Dialog>
 */
export function Dialog({ open, onClose, title, description, footer, children, className }) {
  const ref = useRef(null);
  const t = useTranslations("common");
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      onClick={(e) => e.target === ref.current && onClose?.()}
      aria-labelledby={titleId}
      className={cn(
        "toast-in m-auto w-[min(480px,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-ink/30",
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
            <div>
              <h2 id={titleId} className="text-base font-semibold">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className="-m-1.5 rounded-sm p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label={t("close")}>
              <X className="size-4" />
            </button>
          </header>
          <div className="overflow-y-auto px-6 pb-5">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
