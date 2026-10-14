import { Suspense } from "react";
import { ArrowUpRight, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { LeadForm } from "@/components/site/LeadForm";
import { Skeleton } from "@/components/ui/States";
import { formatPhone } from "@/lib/format";
import { getPublishedProjectsOrDefer, getSiteOrgOrNull } from "@/lib/public/api";
import { buildMetadata } from "@/lib/public/seo";
import { pick, telHref, whatsappHref } from "@/lib/public/site";

export async function generateMetadata() {
  const [locale, t, ts, org] = await Promise.all([getLocale(), getTranslations("site.contactPage"), getTranslations("site"), getSiteOrgOrNull()]);
  const name = pick(org, "name", locale) || ts("brandFallback");
  return buildMetadata({ key: "contact", locale, path: "/contact", company: name, title: t("metaTitle"), description: t("metaDescription", { name }) });
}

async function ContactBody() {
  const [locale, t, org, projects] = await Promise.all([getLocale(), getTranslations("site.contactPage"), getSiteOrgOrNull(), getPublishedProjectsOrDefer()]);
  const address = pick(org, "address", locale);
  const cards = [
    org?.phone && { icon: Phone, label: t("phone"), value: formatPhone(org.phone, locale), href: telHref(org.phone), mono: true },
    org?.phone && { icon: MessageCircle, label: t("whatsapp"), value: t("whatsappValue"), href: whatsappHref(org.phone), external: true },
    org?.email && { icon: Mail, label: t("email"), value: org.email, href: `mailto:${org.email}` },
    address && {
      icon: MapPin,
      label: t("office"),
      value: address,
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(org.address || address)}`,
      external: true,
    },
  ].filter(Boolean);

  return (
    <div className="bg-[linear-gradient(to_bottom,var(--pp-sage-tint)_0,var(--pp-sage-tint)_22rem,transparent_22rem)]">
    <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 pt-16 pb-24 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:px-8 lg:pt-24">
      <div>
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-5 font-display text-4xl leading-[1.06] sm:text-5xl">{t.rich("title", { em: (c) => <em className="text-accent italic">{c}</em> })}</h1>
        <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ink-muted">{t("intro")}</p>
        {cards.length > 0 ? (
          <ul className="mt-10 divide-y divide-line border-y border-line">
            {cards.map((c) => (
              <li key={c.label}>
                <a href={c.href} {...(c.external && { target: "_blank", rel: "noopener noreferrer" })} className="group flex items-start gap-4 py-5">
                  <c.icon aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={1.5} />
                  <span className="min-w-0 flex-1">
                    <span className="caps block text-[10px] font-semibold text-ink-muted">{c.label}</span>
                    <span className={`mt-1 block text-base break-words ${c.mono ? "font-mono" : ""}`}>{c.value}</span>
                  </span>
                  <ArrowUpRight aria-hidden className="mt-1 size-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-10 text-sm text-ink-muted">{t("soon")}</p>
        )}
      </div>
      <div>
        <h2 className="sr-only">{t("formTitle")}</h2>
        <LeadForm phone={org?.phone} projects={projects.map((p) => ({ slug: p.slug, name: pick(p, "name", locale) }))} />
      </div>
    </div>
    </div>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-16 h-96 w-full max-w-7xl" />}>
      <ContactBody />
    </Suspense>
  );
}
