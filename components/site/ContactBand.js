import { Mail, MessageCircle, Phone } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { formatPhone } from "@/lib/format";
import { getSiteOrgOrNull } from "@/lib/public/api";
import { telHref, whatsappHref } from "@/lib/public/site";

/**
 * "Talk to us" band at the end of project/unit pages. Phone, WhatsApp and email from the
 * organization settings. (The enquiry form joins here once the Leads module exists — B3.)
 */
export async function ContactBand({ title, body }) {
  const [org, locale, t] = await Promise.all([getSiteOrgOrNull(), getLocale(), getTranslations("site.contact")]);
  const actions = [
    org?.phone && { href: telHref(org.phone), icon: Phone, label: t("call", { phone: formatPhone(org.phone, locale) }), primary: true },
    org?.phone && { href: whatsappHref(org.phone), icon: MessageCircle, label: t("whatsapp"), external: true },
    org?.email && { href: `mailto:${org.email}`, icon: Mail, label: t("email") },
  ].filter(Boolean);

  return (
    <section aria-labelledby="contact-band" className="grain border-y border-sage-line bg-sage-tint">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:px-8">
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h2 id="contact-band" className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
            {title}
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-muted">{body}</p>
        </div>
        {actions.length > 0 ? (
          <ul className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap lg:flex-col lg:items-stretch">
            {actions.map((a) => (
              <li key={a.href}>
                <a
                  href={a.href}
                  {...(a.external && { target: "_blank", rel: "noopener noreferrer" })}
                  className={
                    a.primary
                      ? "flex h-12 items-center justify-center gap-2.5 rounded-md bg-primary px-6 text-sm font-medium text-primary-ink transition-colors hover:bg-primary-hover"
                      : "flex h-12 items-center justify-center gap-2.5 rounded-md border border-line-strong bg-surface px-6 text-sm font-medium transition-colors hover:bg-surface-2"
                  }
                >
                  <a.icon aria-hidden className="size-4" strokeWidth={1.75} />
                  {a.label}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-muted">{t("soon")}</p>
        )}
      </div>
    </section>
  );
}
