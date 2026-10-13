"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Small popover menu: <Menu label="…" trigger={(props) => <Button {...props}>…</Button>} items={[{ key, label, onSelect, icon?, danger?, disabled?, current? }]} />
 * Click outside / Esc closes; arrow keys move between items.
 */
export function Menu({ trigger, items, align = "right", label, className, width = "w-56" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const listRef = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const els = [...(listRef.current?.querySelectorAll("button:not([disabled])") ?? [])];
        const i = els.indexOf(document.activeElement);
        const next = e.key === "ArrowDown" ? (i + 1) % els.length : (i - 1 + els.length) % els.length;
        els[next]?.focus();
      }
    };
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    listRef.current?.querySelector("button:not([disabled])")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {trigger({
        onClick: (e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        },
        onPointerDown: (e) => e.stopPropagation(),
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? id : undefined,
      })}
      {open && (
        <div
          id={id}
          ref={listRef}
          role="menu"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "toast-in absolute z-40 mt-1.5 max-h-80 overflow-y-auto rounded-lg border border-line bg-surface py-1.5 shadow-[0_12px_32px_-16px_rgb(28_29_26_/_0.3)]",
            align === "right" ? "right-0" : "left-0",
            width,
          )}
        >
          {label && <p className="px-3.5 pt-1 pb-2 text-[11px] font-semibold tracking-wide text-ink-subtle uppercase">{label}</p>}
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              aria-current={it.current || undefined}
              onClick={() => {
                setOpen(false);
                it.onSelect?.();
              }}
              className={cn(
                "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-45",
                it.danger ? "text-danger hover:bg-danger-bg" : "hover:bg-surface-2",
                it.current && "font-semibold",
              )}
            >
              {it.icon}
              <span className="min-w-0 flex-1 truncate">{it.label}</span>
              {it.hint && <span className="text-xs text-ink-subtle">{it.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
