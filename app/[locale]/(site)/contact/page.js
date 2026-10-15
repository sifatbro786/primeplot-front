import { Suspense } from "react";
import { ArrowUpRight, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { SmartImage } from "@/components/media/SmartImage";
import { LeadForm } from "@/components/site/LeadForm";
import { Reveal } from "@/components/site/Reveal";
import { Skeleton } from "@/components/ui/States";
import { formatPhone, localizeDigits } from "@/lib/format";
import { getPublishedProjectsOrDefer, getSiteOrgOrNull } from "@/lib/public/api";
import { buildMetadata } from "@/lib/public/seo";
import { pick, telHref, whatsappHref } from "@/lib/public/site";

export async function generateMetadata() {
  const [locale, t, ts, org] = await Promise.all([getLocale(), getTranslations("site.contactPage"), getTranslations("site"), getSiteOrgOrNull()]);
  const name = pick(org, "name", locale) || ts("brandFallback");
  return buildMetadata({ key: "contact", locale, path: "/contact", company: name, title: t("metaTitle"), description: t("metaDescription", { name }) });
}

const WRAP = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";
const NEXT = ["reply", "call", "visit"];

async function ContactBody() {
  const [locale, t, org, projects] = await Promise.all([getLocale(), getTranslations("site.contactPage"), getSiteOrgOrNull(), getPublishedProjectsOrDefer()]);
  const address = pick(org, "address", locale);
  const tel = telHref(org?.phone);
  const wa = whatsappHref(org?.phone);
  const mapsHref = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(org.address || address)}` : null;
  const channels = [
    org?.phone && { icon: Phone, label: t("phone"), value: formatPhone(org.phone, locale), href: tel, mono: true },
    org?.phone && { icon: MessageCircle, label: t("whatsapp"), value: t("whatsappValue"), href: wa, external: true },
    org?.email && { icon: Mail, label: t("email"), value: org.email, href: `mailto:${org.email}` },
  ].filter(Boolean);

  return (
    <>
      {/* Page header — sage band, like the other public page headers */}
      <header className="grain border-b border-sage-line bg-sage-tint">
        <div className={`${WRAP} grid gap-10 pt-16 pb-14 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:pt-24 lg:pb-16`}>
          <div>
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 className="mt-5 max-w-2xl font-display text-4xl leading-[1.06] sm:text-5xl lg:text-6xl">
              {t.rich("title", { em: (c) => <em className="text-accent italic">{c}</em> })}
            </h1>
            <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-ink-muted">{t("intro")}</p>
          </div>
          {tel && (
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <a href={tel} className="inline-flex h-12 items-center gap-2.5 rounded-md bg-primary px-6 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover">
                <Phone aria-hidden className="size-4" strokeWidth={1.75} />
                <span className="font-mono">{formatPhone(org.phone, locale)}</span>
              </a>
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-12 items-center gap-2.5 rounded-md border border-primary/30 bg-surface/60 px-6 text-sm font-medium text-ink transition-colors hover:bg-surface"
              >
                <MessageCircle aria-hidden className="size-4" strokeWidth={1.75} />
                {t("whatsapp")}
              </a>
            </div>
          )}
        </div>
      </header>

      {/* Ways to reach us + the enquiry form */}
      <div className={`${WRAP} grid gap-12 py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:py-20`}>
        <aside className="space-y-8 lg:sticky lg:top-28 lg:self-start">
          {channels.length > 0 || address ? (
            <>
              {channels.length > 0 && (
                <div>
                  <p className="caps text-[10px] font-semibold text-ink-muted">{t("reachTitle")}</p>
                  <ul className="mt-4 overflow-hidden rounded-lg border border-line bg-surface">
                    {channels.map((c) => (
                      <li key={c.label} className="border-line not-last:border-b">
                        <a href={c.href} {...(c.external && { target: "_blank", rel: "noopener noreferrer" })} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-accent-soft">
                          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-sage-tint text-accent">
                            <c.icon aria-hidden className="size-[18px]" strokeWidth={1.5} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="caps block text-[10px] font-semibold text-ink-muted">{c.label}</span>
                            <span className={`mt-0.5 block text-[15px] break-words ${c.mono ? "font-mono" : ""}`}>{c.value}</span>
                          </span>
                          <ArrowUpRight aria-hidden className="size-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {address && (
                <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="group relative block aspect-[16/11] overflow-hidden rounded-lg bg-primary">
                  <SmartImage category="city" seed="contact-office" alt="" sizes="(min-width: 1024px) 40vw, 100vw" className="absolute inset-0 opacity-70 transition-transform duration-700 group-hover:scale-[1.03]" />
                  <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-primary-deep/95 via-primary-deep/50 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 p-6 text-primary-ink">
                    <span className="caps flex items-center gap-2 text-[10px] font-semibold text-accent-on-dark">
                      <MapPin aria-hidden className="size-3.5" strokeWidth={1.75} />
                      {t("office")}
                    </span>
                    <span className="mt-2 block font-display text-xl leading-snug sm:text-2xl">{address}</span>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 group-hover:underline">
                      {t("directions")}
                      <ArrowUpRight aria-hidden className="size-4" />
                    </span>
                  </span>
                </a>
              )}
            </>
          ) : (
            <p className="text-sm text-ink-muted">{t("soon")}</p>
          )}
        </aside>

        <section aria-labelledby="contact-form">
          <p className="eyebrow">{t("formEyebrow")}</p>
          <h2 id="contact-form" className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
            {t("formTitle")}
          </h2>
          <p className="mt-3 mb-8 max-w-lg text-sm leading-relaxed text-ink-muted">{t("formIntro")}</p>
          <LeadForm phone={org?.phone} projects={projects.map((p) => ({ slug: p.slug, name: pick(p, "name", locale) }))} />
        </section>
      </div>

      {/* What happens after you get in touch */}
      <Reveal as="section" aria-labelledby="contact-next" className="border-t border-line bg-surface">
        <div className={`${WRAP} grid gap-10 py-16 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:py-20`}>
          <div data-reveal>
            <p className="eyebrow">{t("nextEyebrow")}</p>
            <h2 id="contact-next" className="mt-3 font-display text-3xl leading-tight">
              {t("nextTitle")}
            </h2>
          </div>
          <ol className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
            {NEXT.map((k, i) => (
              <li key={k} data-reveal className="bg-paper p-6">
                <span className="font-display text-3xl text-accent">{localizeDigits(String(i + 1).padStart(2, "0"), locale)}</span>
                <h3 className="mt-4 text-base font-semibold">{t(`next.${k}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t(`next.${k}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>
    </>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-16 h-96 w-full max-w-7xl" />}>
      <ContactBody />
    </Suspense>
  );
}
