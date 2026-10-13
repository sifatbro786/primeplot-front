import { Suspense } from "react";
import { FileCheck, Handshake, Phone, Ruler, Search } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { LandownerForm } from "@/components/site/LandownerForm";
import { Reveal } from "@/components/site/Reveal";
import { Skeleton } from "@/components/ui/States";
import { formatPhone } from "@/lib/format";
import { getSiteOrgOrNull } from "@/lib/public/api";
import { alternatesFor, pick, telHref } from "@/lib/public/site";

export async function generateMetadata() {
  const [locale, t, ts, org] = await Promise.all([getLocale(), getTranslations("site.landowners"), getTranslations("site"), getSiteOrgOrNull()]);
  const name = pick(org, "name", locale) || ts("brandFallback");
  return { title: t("metaTitle"), description: t("metaDescription", { name }), alternates: alternatesFor(locale, "/landowners") };
}

const STEPS = [
  { k: "tell", icon: Phone },
  { k: "visit", icon: Search },
  { k: "papers", icon: FileCheck },
  { k: "agree", icon: Handshake },
];
const LOOK = ["size", "road", "title", "location"];

async function LandownersBody() {
  const [locale, t, ts, org] = await Promise.all([getLocale(), getTranslations("site.landowners"), getTranslations("site"), getSiteOrgOrNull()]);
  const name = pick(org, "name", locale) || ts("brandFallback");
  const tel = telHref(org?.phone);

  return (
    <>
      <div className="bg-[linear-gradient(to_bottom,var(--pp-sage-tint)_0,var(--pp-sage-tint)_26rem,transparent_26rem)]">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:px-8 lg:pt-24">
          <div>
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 className="mt-5 font-display text-4xl leading-[1.06] sm:text-5xl">{t.rich("title", { em: (c) => <em className="text-accent italic">{c}</em> })}</h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ink-muted">{t("intro", { name })}</p>

            <div className="mt-10">
              <p className="caps text-[10px] font-semibold text-ink-muted">{t("lookTitle")}</p>
              <ul className="mt-3 divide-y divide-line border-y border-line">
                {LOOK.map((k) => (
                  <li key={k} className="flex gap-3 py-3.5">
                    <Ruler aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={1.5} />
                    <span className="text-sm leading-relaxed">
                      <span className="font-medium">{t(`look.${k}.title`)}</span>
                      <span className="text-ink-muted"> — {t(`look.${k}.body`)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {tel && (
              <p className="mt-8 text-sm text-ink-muted">
                {t("callInstead")}{" "}
                <a href={tel} className="font-mono text-ink underline-offset-4 hover:underline">
                  {formatPhone(org.phone, locale)}
                </a>
              </p>
            )}
          </div>
          <div>
            <h2 className="sr-only">{t("formTitle")}</h2>
            <LandownerForm />
          </div>
        </div>
      </div>

      <Reveal as="section" aria-labelledby="jv-steps" className="band-dark grain">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div data-reveal className="max-w-2xl">
            <p className="eyebrow">{t("stepsEyebrow")}</p>
            <h2 id="jv-steps" className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
              {t("stepsTitle")}
            </h2>
          </div>
          <ol className="mt-10 grid gap-px overflow-hidden rounded-lg border border-primary-deep bg-primary-deep sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ k, icon: Icon }, i) => (
              <li key={k} data-reveal className="bg-primary p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <Icon aria-hidden className="size-6 text-accent-on-dark" strokeWidth={1.25} />
                  <span className="font-mono text-xs text-primary-ink/40">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-5 text-base font-semibold">{t(`steps.${k}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-primary-ink/70">{t(`steps.${k}.body`)}</p>
              </li>
            ))}
          </ol>
          <p data-reveal className="mt-8 max-w-2xl text-sm leading-relaxed text-primary-ink/60">
            {t("stepsNote")}
          </p>
        </div>
      </Reveal>
    </>
  );
}

export default function LandownersPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-16 h-96 w-full max-w-7xl" />}>
      <LandownersBody />
    </Suspense>
  );
}
