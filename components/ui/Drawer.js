"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/**
 * Side sheet on the native <dialog>: focus trap, Esc to close, inert background and top-layer
 * stacking come from the browser — no portal or focus-lock library.
 * <Drawer open={open} onClose={() => setOpen(false)} title="Lead" side="right" width="md">…</Drawer>
 */
const WIDTHS = { sm: "sm:w-[380px]", md: "sm:w-[520px]", lg: "sm:w-[720px]" };

export function Drawer({ open, onClose, title, description, side = "right", width = "md", footer, children }) {
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
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault(); // let the parent own state; it closes via `open`
        onClose?.();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose?.(); // backdrop click
      }}
      aria-labelledby={titleId}
      className={cn(
        "drawer m-0 h-dvh max-h-dvh w-full max-w-full border-line bg-surface p-0 text-ink",
        side === "right" ? "ml-auto border-l" : "mr-auto border-r",
        WIDTHS[width],
        "backdrop:bg-ink/30",
      )}
      data-side={side}
    >
      {open && (
        <div className="flex h-full flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
            <div>
              <h2 id={titleId} className="text-base font-semibold">
                {title}
              </h2>
              {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-m-1.5 rounded-sm p-1.5 text-ink-muted hover:bg-surface-2 hover:text-ink"
              aria-label={t("close")}
            >
              <X className="size-4" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <footer className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
