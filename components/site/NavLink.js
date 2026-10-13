"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/**
 * Header link that marks the current page with aria-current (path only — a link with a query,
 * like "?type=plot", is never marked). Reads the pathname → render inside <Suspense> (dynamic
 * routes), with `NavLinkStatic` as the fallback.
 */
export function NavLink({ href, className, children, onClick }) {
  const pathname = usePathname();
  const active = !href.includes("?") && pathname === href;
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "transition-colors",
        active ? "text-ink underline decoration-accent decoration-1 underline-offset-[6px]" : "text-ink-muted hover:text-ink",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function NavLinkStatic({ href, className, children }) {
  return (
    <Link href={href} className={cn("text-ink-muted transition-colors hover:text-ink", className)}>
      {children}
    </Link>
  );
}
