"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { isActive } from "@/lib/nav";

/** Olive-charcoal sidebar. `groups` are already permission-filtered. */
export function Sidebar({ groups, orgName, onNavigate, loading }) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("main")} className="flex h-full flex-col bg-primary text-primary-ink">
      <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-6">
        <Link href="/dashboard" onClick={onNavigate} className="text-[13px] font-semibold tracking-[0.32em]">
          PRIMEPLOT
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        {loading ? (
          <ul className="space-y-2 px-3" aria-hidden>
            {Array.from({ length: 7 }, (_, i) => (
              <li key={i} className="h-4 w-3/4 animate-pulse rounded-sm bg-white/8" />
            ))}
          </ul>
        ) : (
          groups.map((g) => (
            <div key={g.group} className="mb-6 last:mb-0">
              {g.group !== "workspace" && (
                <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.18em] text-primary-ink/50 uppercase">
                  {t(`groups.${g.group}`)}
                </p>
              )}
              <ul className="space-y-0.5">
                {g.items.map((item) => {
                  const active = isActive(pathname, item);
                  const Icon = item.icon;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                          active
                            ? "bg-white/10 text-primary-ink"
                            : "text-primary-ink/70 hover:bg-white/5 hover:text-primary-ink",
                        )}
                      >
                        {active && <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent-on-dark" />}
                        <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.6} />
                        <span className="flex-1 truncate">{t(item.key)}</span>
                        {item.phase && (
                          <span className="font-mono text-[9px] tracking-wide text-primary-ink/40">{item.phase}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-white/10 px-6 py-4">
        <p className="truncate text-xs text-primary-ink/60">{orgName}</p>
      </div>
    </nav>
  );
}
