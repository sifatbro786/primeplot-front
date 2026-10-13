import { Suspense } from "react";
import { Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import { Link } from "@/i18n/navigation";
import { getSiteOrgOrNull } from "@/lib/public/api";
import { formatPhone } from "@/lib/format";
import { telHref } from "@/lib/public/site";
import { Brand } from "./Brand";
import { MobileNav } from "./MobileNav";
import { NavLink, NavLinkStatic } from "./NavLink";

export const SITE_NAV = [
  { href: "/projects", key: "projects" },
  { href: "/projects?type=apartment", key: "apartments" },
  { href: "/projects?type=plot", key: "plots" },
  { href: "/landowners", key: "landowners" },
  { href: "/about", key: "about" },
  { href: "/contact", key: "contact" },
];

async function HeaderBrand() {
  const [org, locale, t] = await Promise.all([getSiteOrgOrNull(), getLocale(), getTranslations("site")]);
  return <Brand org={org} locale={locale} fallback={t("brandFallback")} />;
}

async function HeaderCall() {
  const [org, locale, t] = await Promise.all([getSiteOrgOrNull(), getLocale(), getTranslations("site.header")]);
  const href = telHref(org?.phone);
  if (!href) return null;
  return (
    <a
      href={href}
      className="hidden h-9 items-center gap-2 rounded-md border border-line-strong px-3 text-xs font-medium transition-colors hover:bg-surface sm:inline-flex"
    >
      <Phone aria-hidden className="size-3.5" strokeWidth={1.75} />
      <span className="sr-only">{t("call")}</span>
      <span className="font-mono tracking-tight">{formatPhone(org.phone, locale)}</span>
    </a>
  );
}

/** Sticky, hairline-bottomed bar: brand · nav · language · call. Mobile: brand · language · menu. */
export async function SiteHeader() {
  const t = await getTranslations("site");
  const items = SITE_NAV.map((n) => ({ ...n, label: t(`nav.${n.key}`) }));
  return (
    <header className="sticky top-0 z-40 border-b border-sage-line/70 bg-paper/95 backdrop-blur-[2px] supports-[backdrop-filter]:bg-paper/85">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="min-w-0 flex-1 rounded-sm lg:flex-none" aria-label={t("header.home")}>
          <Suspense fallback={<span className="text-[13px] font-semibold tracking-[0.28em] uppercase">{t("brandFallback")}</span>}>
            <HeaderBrand />
          </Suspense>
        </Link>

        <nav aria-label={t("header.primaryNav")} className="ml-6 hidden items-center gap-7 lg:flex">
          {items.map((n) =>
            n.href.startsWith("#") ? (
              <a key={n.key} href={n.href} className="text-[13px] text-ink-muted transition-colors hover:text-ink">
                {n.label}
              </a>
            ) : (
              <Suspense
                key={n.key}
                fallback={
                  <NavLinkStatic href={n.href} className="text-[13px]">
                    {n.label}
                  </NavLinkStatic>
                }
              >
                <NavLink href={n.href} className="text-[13px]">
                  {n.label}
                </NavLink>
              </Suspense>
            ),
          )}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
          {/* The switcher reads the pathname (unknown while a dynamic route prerenders). */}
          <Suspense fallback={<span className="w-[4.25rem]" aria-hidden />}>
            <LocaleSwitcher />
          </Suspense>
          <Suspense fallback={null}>
            <HeaderCall />
          </Suspense>
          <MobileNav items={items} />
        </div>
      </div>
    </header>
  );
}
