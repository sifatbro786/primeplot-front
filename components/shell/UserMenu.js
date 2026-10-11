"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useLogout } from "@/lib/auth/session";
import { cn } from "@/lib/cn";

export function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)[0] : "")).toUpperCase() || "·";
}

export function UserMenu({ user, accountHref }) {
  const t = useTranslations("shell");
  const tr = useTranslations("roles");
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return <span className="size-8 animate-pulse rounded-full bg-surface-3" aria-hidden />;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-md py-1 pr-1.5 pl-1 hover:bg-surface-2"
      >
        <span className="grid size-8 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-ink">
          {initials(user.name)}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-36 truncate text-sm font-medium">{user.name}</span>
          <span className="block text-[11px] text-ink-muted">{tr(user.role)}</span>
        </span>
        <ChevronDown aria-hidden className={cn("size-3.5 text-ink-subtle transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div role="menu" className="toast-in absolute right-0 z-40 mt-2 w-64 rounded-lg border border-line bg-surface py-1.5 shadow-[0_12px_32px_-16px_rgb(28_29_26_/_0.3)]">
          <div className="border-b border-line px-4 pt-2 pb-3">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-ink-muted">{user.email}</p>
          </div>
          <Link
            role="menuitem"
            href={accountHref}
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-surface-2"
          >
            <UserRound aria-hidden className="size-4 text-ink-muted" />
            {t("account")}
          </Link>
          <button
            role="menuitem"
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-sm text-danger hover:bg-danger-bg"
          >
            <LogOut aria-hidden className="size-4" />
            {t("logout")}
          </button>
        </div>
      )}
    </div>
  );
}
