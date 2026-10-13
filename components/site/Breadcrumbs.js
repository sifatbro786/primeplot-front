import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { absoluteUrl, jsonLd } from "@/lib/public/site";

/** Visible trail + BreadcrumbList JSON-LD. items: [{ href?, label }] (last = current page). */
export function Breadcrumbs({ items, locale, label }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.label,
      ...(it.href && { item: absoluteUrl(locale, it.href) }),
    })),
  };
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight aria-hidden className="size-3 text-ink-subtle" />}
            {it.href && i < items.length - 1 ? (
              <Link href={it.href} className="hover:text-ink hover:underline">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className="max-w-[16rem] truncate text-ink">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(data) }} />
    </nav>
  );
}
