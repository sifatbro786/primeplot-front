"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { NotificationBell } from "@/components/crm/NotificationBell";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/States";
import { usePathname } from "@/i18n/navigation";
import { errorMessage, useSession, useSessionExpiryRedirect } from "@/lib/auth/session";
import { findNavItem, STAFF_NAV, visibleNav } from "@/lib/nav";
import { CommandPalette } from "./CommandPalette";
import { Sidebar } from "./Sidebar";
import { UserMenu } from "./UserMenu";

const ACCOUNT = "/dashboard/account";

export function DashboardShell({ children }) {
  const t = useTranslations("nav");
  const ts = useTranslations("shell");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const session = useSession();
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const navRef = useRef(null);
  useSessionExpiryRedirect();

  const groups = session.user ? visibleNav(STAFF_NAV, session.can) : [];
  const current = pathname.startsWith(ACCOUNT) ? { key: "account" } : findNavItem(STAFF_NAV, pathname);
  const title = current ? (current.key === "account" ? ts("account") : t(current.key)) : "";

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Mobile off-canvas nav on a native <dialog>.
  useEffect(() => {
    const d = navRef.current;
    if (!d) return;
    if (navOpen && !d.open) d.showModal();
    if (!navOpen && d.open) d.close();
  }, [navOpen]);

  const sidebar = (onNavigate) => (
    <Sidebar groups={groups} orgName={session.org?.name} loading={session.isPending} onNavigate={onNavigate} />
  );

  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 lg:block">{sidebar()}</aside>

      <dialog
        ref={navRef}
        onClose={() => setNavOpen(false)}
        onClick={(e) => e.target === navRef.current && setNavOpen(false)}
        className="drawer m-0 h-dvh max-h-dvh w-64 max-w-[85vw] border-0 p-0 backdrop:bg-ink/30"
        data-side="left"
        aria-label={t("main")}
      >
        {navOpen && sidebar(() => setNavOpen(false))}
      </dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-canvas/90 px-4 backdrop-blur-sm sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setNavOpen(true)} aria-label={ts("openMenu")}>
            <Menu className="size-5" />
          </Button>
          <h1 className="truncate text-sm font-semibold">{title}</h1>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden h-9 w-56 items-center gap-2 rounded-md border border-line bg-surface px-3 text-left text-sm text-ink-subtle hover:border-line-strong md:flex"
          >
            <Search aria-hidden className="size-4" />
            <span className="flex-1">{ts("search")}</span>
            <kbd className="rounded-sm border border-line px-1 font-mono text-[10px]">Ctrl K</kbd>
          </button>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setPaletteOpen(true)} aria-label={ts("search")}>
            <Search className="size-4" />
          </Button>
          {session.user && <NotificationBell />}
          <LocaleSwitcher className="hidden sm:inline-flex" />
          <UserMenu user={session.user} accountHref={ACCOUNT} />
        </header>

        <main className="flex-1 px-4 py-8 sm:px-8">
          {session.isError ? (
            <ErrorState
              title={ts("loadFailed")}
              description={errorMessage(te, session.error)}
              requestId={session.error?.requestId}
              requestIdLabel={tc("requestId")}
              action={
                <Button size="sm" variant="secondary" onClick={() => session.refetch()}>
                  {tc("retry")}
                </Button>
              }
            />
          ) : (
            children
          )}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} groups={groups} accountHref={ACCOUNT} />
    </div>
  );
}
