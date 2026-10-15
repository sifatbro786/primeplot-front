"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const GAP = 6;
const EDGE = 8;

/**
 * Small popover menu: <Menu label="…" trigger={(props) => <Button {...props}>…</Button>} items={[{ key, label, onSelect, icon?, danger?, disabled?, current? }]} />
 * Click outside / Esc closes; arrow keys move between items.
 *
 * The list opens in the browser's top layer (Popover API) at fixed coordinates next to the
 * trigger, so a menu inside a scrolling table or a drawer never makes that box grow a scrollbar
 * or get clipped. It flips above the trigger when there is no room below and follows the
 * trigger while the page scrolls. Older browsers fall back to an absolutely positioned list.
 */
export function Menu({ trigger, items, align = "right", label, className, width = "w-56" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const listRef = useRef(null);
  const id = useId();

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!open || !list || typeof list.showPopover !== "function") return undefined;
    const place = () => {
      const anchor = ref.current?.getBoundingClientRect();
      if (!anchor) return;
      const w = list.offsetWidth;
      const h = list.offsetHeight;
      const below = anchor.bottom + GAP;
      const fitsBelow = below + h <= window.innerHeight - EDGE;
      const top = fitsBelow || anchor.top - GAP - h < EDGE ? Math.min(below, window.innerHeight - EDGE - h) : anchor.top - GAP - h;
      const left = align === "right" ? anchor.right - w : anchor.left;
      list.style.top = `${Math.max(EDGE, top)}px`;
      list.style.left = `${Math.min(Math.max(EDGE, left), window.innerWidth - EDGE - w)}px`;
    };
    try {
      list.showPopover();
    } catch {
      return undefined; // already shown / unsupported state — keep the fallback layout
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      try {
        list.hidePopover();
      } catch {
        // already hidden
      }
    };
  }, [open, align]);

  useEffect(() => {
    if (!open) return undefined;
    // The list is a DOM child of the wrapper even while it sits in the top layer.
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault(); // inside a drawer: close the menu, not the drawer
        setOpen(false);
      }
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
          popover="manual"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            // Fallback (no Popover API): absolute under the trigger. With it: fixed, placed by JS.
            "toast-in absolute z-40 mt-1.5 max-h-80 overflow-y-auto rounded-lg border border-line bg-surface py-1.5 text-ink shadow-[0_12px_32px_-16px_rgb(28_29_26_/_0.3)]",
            "[&:popover-open]:fixed [&:popover-open]:inset-auto [&:popover-open]:m-0",
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
