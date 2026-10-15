"use client";

import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import { Link, usePathname } from "@/i18n/navigation";
import { useSession, useSessionExpiryRedirect } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { isActive, PORTAL_NAV } from "@/lib/nav";
import { UserMenu } from "./UserMenu";

/**
 * Customer portal: mobile-first. Top bar + bottom tab bar on phones, inline tabs on desktop.
 * `.portal` = the "passbook" look (warm paper, owner choice 2026-10-15).
 */
export function PortalShell({ children }) {
  const t = useTranslations("portalNav");
  const session = useSession();
  const pathname = usePathname();
  useSessionExpiryRedirect();

  return (
    <div className="portal grain flex min-h-dvh flex-1 flex-col pb-16 md:pb-0">
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-paper/95">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-4 sm:px-6">
          <Link href="/portal" className="min-w-0">
            <span className="block text-[11px] font-semibold tracking-[0.32em]">PRIMEPLOT</span>
            <span className="block truncate text-xs text-ink-muted">{session.org?.name ?? " "}</span>
          </Link>
          <nav aria-label={t("label")} className="hidden flex-1 md:block">
            <ul className="flex gap-1">
              {PORTAL_NAV.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={isActive(pathname, item) ? "page" : undefined}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm transition-colors",
                      isActive(pathname, item) ? "bg-accent-soft font-medium text-ink" : "text-ink-muted hover:text-ink",
                    )}
                  >
                    {t(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-1 items-center justify-end gap-3 md:flex-none">
            <LocaleSwitcher />
            <UserMenu user={session.user} accountHref="/portal/account" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-10 sm:px-6 sm:pt-10">{children}</main>

      {/* Phone tab bar — thumb reach. */}
      <nav aria-label={t("label")} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="grid grid-cols-4">
          {PORTAL_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item);
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px]", active ? "text-ink" : "text-ink-subtle")}
                >
                  <Icon aria-hidden className="size-5" strokeWidth={active ? 2 : 1.6} />
                  {t(item.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
