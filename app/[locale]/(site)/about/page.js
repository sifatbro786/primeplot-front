import { Suspense } from "react";
import { BadgeCheck, Building2, Eye, QrCode, ReceiptText } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { ContactBand } from "@/components/site/ContactBand";
import { Reveal } from "@/components/site/Reveal";
import { StatsBand } from "@/components/site/StatsBand";
import { SmartImage } from "@/components/media/SmartImage";
import { Skeleton } from "@/components/ui/States";
import { Link } from "@/i18n/navigation";
import { getPublishedProjectsOrDefer, getSiteOrgOrNull } from "@/lib/public/api";
import { catalogueStats } from "@/lib/public/listing";
import { alternatesFor, pick } from "@/lib/public/site";

export async function generateMetadata() {
  const [locale, t, ts, org] = await Promise.all([getLocale(), getTranslations("site.about"), getTranslations("site"), getSiteOrgOrNull()]);
  const name = pick(org, "name", locale) || ts("brandFallback");
  return { title: t("metaTitle"), description: t("metaDescription", { name }), alternates: alternatesFor(locale, "/about") };
}

const PRINCIPLES = [
  { k: "live", icon: Eye },
  { k: "price", icon: ReceiptText },
  { k: "verify", icon: QrCode },
  { k: "portal", icon: Building2 },
];

async function AboutBody() {
  const [locale, t, ts, org, projects] = await Promise.all([
    getLocale(),
    getTranslations("site.about"),
    getTranslations("site"),
    getSiteOrgOrNull(),
    getPublishedProjectsOrDefer(),
  ]);
  const name = pick(org, "name", locale) || ts("brandFallback");
  const creds = [
    org?.tradeLicenseNo && { k: t("tradeLicense"), v: org.tradeLicenseNo },
    org?.rehabMemberNo && { k: t("rehab"), v: org.rehabMemberNo },
    pick(org, "address", locale) && { k: t("office"), v: pick(org, "address", locale) },
  ].filter(Boolean);

  return (
    <>
      <header className="mx-auto grid w-full max-w-7xl gap-10 px-4 pt-16 sm:px-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:px-8 lg:pt-24">
        <div>
          <p className="eyebrow">{t("eyebrow")}</p>
          <h1 className="mt-5 font-display text-4xl leading-[1.06] sm:text-5xl lg:text-6xl">
            {t.rich("title", { name, em: (c) => <em className="text-accent italic">{c}</em> })}
          </h1>
          <div className="mt-8 max-w-xl space-y-4 text-[15px] leading-relaxed text-ink-muted">
            <p>{t("intro1", { name })}</p>
            <p>{t("intro2")}</p>
          </div>
        </div>
        <div className="relative aspect-[4/5] overflow-hidden rounded-lg lg:aspect-auto lg:min-h-[32rem]">
          <SmartImage category="apartment-exterior" seed="about" alt="" preload sizes="(min-width: 1024px) 50vw, 100vw" className="absolute inset-0" />
        </div>
      </header>

      <Reveal className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div data-reveal className="mt-16">
          <StatsBand stats={catalogueStats(projects)} />
        </div>

      </Reveal>

      <Reveal as="section" aria-labelledby="about-principles" className="band-dark grain mt-24">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div data-reveal className="max-w-2xl">
            <p className="eyebrow">{t("principlesEyebrow")}</p>
            <h2 id="about-principles" className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
              {t("principlesTitle")}
            </h2>
          </div>
          <ul className="mt-10 grid gap-px overflow-hidden rounded-lg border border-primary-deep bg-primary-deep sm:grid-cols-2">
            {PRINCIPLES.map(({ k, icon: Icon }) => (
              <li key={k} data-reveal className="bg-primary p-6 sm:p-8">
                <Icon aria-hidden className="size-6 text-accent-on-dark" strokeWidth={1.25} />
                <h3 className="mt-5 text-base font-semibold">{t(`principles.${k}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-primary-ink/70">{t(`principles.${k}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      <Reveal className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">

        {creds.length > 0 && (
          <section aria-labelledby="about-creds" className="mt-24 grid gap-8 pb-24 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
            <div data-reveal>
              <p className="eyebrow">{t("credsEyebrow")}</p>
              <h2 id="about-creds" className="mt-3 font-display text-3xl">
                {t("credsTitle")}
              </h2>
            </div>
            <dl data-reveal className="divide-y divide-line border-y border-line">
              {creds.map((c) => (
                <div key={c.k} className="flex flex-wrap justify-between gap-4 py-4 text-sm">
                  <dt className="flex items-center gap-2 text-ink-muted">
                    <BadgeCheck aria-hidden className="size-4 text-accent" strokeWidth={1.5} />
                    {c.k}
                  </dt>
                  <dd className="font-mono text-right">{c.v}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        {creds.length === 0 && <div className="pb-24" />}
      </Reveal>

      <ContactBand
        title={t("ctaTitle")}
        body={
          <>
            {t("ctaBody")}{" "}
            <Link href="/projects" className="text-accent underline-offset-4 hover:underline">
              {t("ctaLink")}
            </Link>
          </>
        }
      />
    </>
  );
}

export default function AboutPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-16 h-96 w-full max-w-7xl" />}>
      <AboutBody />
    </Suspense>
  );
}
