import { getLocale, getTranslations } from "next-intl/server";
import { formatDate, formatPhone, localizeDigits } from "@/lib/format";
import { getSiteOrgOrNull } from "@/lib/public/api";
import { alternatesFor, pick, telHref } from "@/lib/public/site";

/** Bump when the text in content/legal/*.json changes (shown as "Last updated"). */
export const LEGAL_UPDATED = { privacy: "2026-10-13", terms: "2026-10-13" };

/**
 * The long legal text lives in content/legal/<locale>.json, not in messages/: messages are sent to
 * the browser on every page, and these pages are plain server-rendered text. Short UI strings
 * (headings, consent banner, footer links) stay in messages › site.legal.
 */
const loadText = async (locale, kind) => (await import(`../../content/legal/${locale === "en" ? "en" : "bn"}.json`)).default[kind];

/** Legal name from Company settings, else the display name. */
const companyOf = (org, locale, fallback) => org?.legalName || pick(org, "name", locale) || fallback;
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);

export async function legalMetadata(kind) {
  const locale = await getLocale();
  const [text, ts, org] = await Promise.all([loadText(locale, kind), getTranslations("site"), getSiteOrgOrNull()]);
  const company = companyOf(org, locale, ts("brandFallback"));
  return { title: text.metaTitle, description: fill(text.metaDescription, { company }), alternates: alternatesFor(locale, `/${kind}`) };
}

/** Privacy Policy / Terms of Use — text from content/legal (BN/EN), company details from settings. */
export async function LegalPage({ kind }) {
  const locale = await getLocale();
  const [text, tl, ts, org] = await Promise.all([
    loadText(locale, kind),
    getTranslations("site.legal"),
    getTranslations("site"),
    getSiteOrgOrNull(),
  ]);
  const company = companyOf(org, locale, ts("brandFallback"));
  const sections = text.sections;
  const num = (i) => localizeDigits(String(i + 1).padStart(2, "0"), locale);

  // Privacy: name the tracking tools actually switched on in Company settings.
  const tools = [org?.analytics?.ga4MeasurementId && "Google Analytics", org?.analytics?.metaPixelId && "Meta Pixel"].filter(Boolean);
  const address = pick(org, "address", locale);

  return (
    <article>
      <header className="grain border-b border-sage-line bg-sage-tint">
        <div className="mx-auto w-full max-w-7xl px-4 pt-16 pb-12 sm:px-6 lg:px-8 lg:pt-20">
          <p className="eyebrow">{text.eyebrow}</p>
          <h1 className="mt-5 font-display text-4xl leading-[1.06] sm:text-5xl">{text.title}</h1>
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-ink-muted">{fill(text.intro, { company })}</p>
          <p className="mt-8 font-mono text-xs text-ink-muted">{tl("updated", { date: formatDate(LEGAL_UPDATED[kind], locale, "long") })}</p>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 pt-14 pb-24 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-20 lg:px-8">
        <nav aria-label={tl("contents")} className="hidden lg:block">
          <div className="sticky top-28">
            <p className="caps text-[10px] font-semibold text-ink-muted">{tl("contents")}</p>
            <ol className="mt-4 space-y-2.5 border-l border-line pl-4 text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="flex gap-3 text-ink-muted hover:text-ink">
                    <span className="font-mono text-[11px] leading-5 text-ink-subtle">{num(i)}</span>
                    <span>{s.h}</span>
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        <div className="max-w-2xl">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-28 border-t border-line py-9 first:border-t-0 first:pt-0">
              <p className="font-mono text-xs text-accent">{num(i)}</p>
              <h2 id={`${s.id}-h`} className="mt-2 font-display text-2xl">
                {s.h}
              </h2>
              <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-muted">
                {s.p?.map((p) => <p key={p}>{fill(p, { company })}</p>)}
                {s.items && (
                  <ul className="space-y-2.5">
                    {s.items.map((it) => (
                      <li key={it} className="flex gap-3">
                        <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" />
                        <span>{fill(it, { company })}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {s.p2?.map((p) => <p key={p}>{fill(p, { company })}</p>)}
                {kind === "privacy" && s.id === "cookies" && <p className="text-ink">{tools.length ? fill(text.toolsActive, { tools: tools.join(", ") }) : text.toolsNone}</p>}
              </div>
            </section>
          ))}

          <aside className="mt-6 rounded-lg border border-line bg-surface p-6 text-sm leading-relaxed">
            <p className="font-semibold">{company}</p>
            {address && <p className="mt-1 text-ink-muted">{address}</p>}
            <p className="mt-3 text-ink-muted">{org?.email || org?.phone ? tl("questions") : tl("questionsNoContact")}</p>
            {(org?.email || org?.phone) && (
              <p className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                {org.phone && (
                  <a href={telHref(org.phone)} className="font-mono text-accent hover:underline">
                    {formatPhone(org.phone, locale)}
                  </a>
                )}
                {org.email && (
                  <a href={`mailto:${org.email}`} className="break-all text-accent hover:underline">
                    {org.email}
                  </a>
                )}
              </p>
            )}
          </aside>
        </div>
      </div>
    </article>
  );
}
