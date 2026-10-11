"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Languages, LogOut, Search, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useLogout } from "@/lib/auth/session";
import { cn } from "@/lib/cn";

/**
 * ⌘K / Ctrl+K — jump to any page the user may open, plus a few actions.
 * Native <dialog> (focus trap, Esc, top layer). Matching is on the translated label and the
 * English key, so "leads" works in Bangla UI too.
 */
export function CommandPalette({ open, onClose, groups, accountHref }) {
  const t = useTranslations("nav");
  const ts = useTranslations("shell");
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const logout = useLogout();
  const ref = useRef(null);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState(0);

  const commands = useMemo(() => {
    const pages = groups.flatMap((g) =>
      g.items.map((i) => ({ id: i.key, label: t(i.key), hint: g.group !== "workspace" ? t(`groups.${g.group}`) : "", icon: i.icon, run: () => router.push(i.href) })),
    );
    return [
      ...pages,
      { id: "account", label: ts("account"), icon: UserRound, run: () => router.push(accountHref) },
      {
        id: "language",
        label: ts("switchLanguage"),
        icon: Languages,
        run: () => router.replace(pathname, { locale: locale === "bn" ? "en" : "bn" }),
      },
      { id: "logout", label: ts("logout"), icon: LogOut, run: logout },
    ];
  }, [groups, t, ts, router, accountHref, pathname, locale, logout]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(s) || c.id.includes(s) || c.hint?.toLowerCase().includes(s));
  }, [q, commands]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setQ("");
      setIndex(0);
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const run = (cmd) => {
    onClose();
    cmd?.run();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(results[index]);
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={ts("commandPalette")}
      className="mx-auto mt-[12vh] w-[min(560px,calc(100vw-2rem))] rounded-lg border border-line bg-surface p-0 text-ink shadow-[0_24px_64px_-24px_rgb(28_29_26_/_0.45)] backdrop:bg-ink/30"
    >
      {open && (
        <div onKeyDown={onKeyDown}>
          <div className="flex items-center gap-3 border-b border-line px-4">
            <Search aria-hidden className="size-4 text-ink-subtle" />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setIndex(0);
              }}
              placeholder={ts("searchPlaceholder")}
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-subtle"
              role="combobox"
              aria-expanded="true"
              aria-controls="cmdk-list"
              aria-activedescendant={results[index] ? `cmdk-${results[index].id}` : undefined}
            />
            <kbd className="rounded-sm border border-line px-1.5 font-mono text-[10px] text-ink-subtle">Esc</kbd>
          </div>
          <ul id="cmdk-list" role="listbox" className="max-h-80 overflow-y-auto p-1.5">
            {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-ink-muted">{ts("noResults")}</li>}
            {results.map((c, i) => {
              const Icon = c.icon;
              return (
                <li
                  key={c.id}
                  id={`cmdk-${c.id}`}
                  role="option"
                  aria-selected={i === index}
                  onMouseMove={() => setIndex(i)}
                  onClick={() => run(c)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm",
                    i === index ? "bg-accent-soft text-ink" : "text-ink-muted",
                  )}
                >
                  <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.6} />
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.hint && <span className="text-[11px] text-ink-subtle">{c.hint}</span>}
                  {i === index && <CornerDownLeft aria-hidden className="size-3.5 text-ink-subtle" />}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </dialog>
  );
}
