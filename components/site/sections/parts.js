import { Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { SmartImage } from "@/components/media/SmartImage";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatDate, formatNumber, localizeDigits } from "@/lib/format";
import { Emph, Paragraphs } from "@/lib/public/content";
import { pick } from "@/lib/public/site";
import { ICONS } from "@/lib/site/icons";

export { ICONS };

export const pad2 = (i, locale) => localizeDigits(String(i + 1).padStart(2, "0"), locale);

/** Eyebrow + title (+ body) used by every section. */
export function SectionHead({ id, eyebrow, title, body, dark = false, className, link }) {
  return (
    <div data-reveal className={cn("flex flex-wrap items-end justify-between gap-4 self-start", className)}>
      <div className="max-w-2xl">
        {eyebrow && <p className={cn("eyebrow", dark && "text-accent-on-dark")}>{eyebrow}</p>}
        {title && (
          <h2 id={id} className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
            <Emph text={title} emClassName={dark ? "italic text-accent-on-dark" : "italic text-accent"} />
          </h2>
        )}
        {body && <p className={cn("mt-4 max-w-xl text-sm leading-relaxed", dark ? "text-primary-ink/70" : "text-ink-muted")}>{body}</p>}
      </div>
      {link}
    </div>
  );
}

/** Initials block for a person without a photo (never a stock face). */
export function Monogram({ name, className }) {
  const letters = String(name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => [...w][0])
    .join("");
  return (
    <div aria-hidden className={cn("grid place-items-center bg-sage-tint font-display text-ink-muted", className)}>
      {letters || "·"}
    </div>
  );
}

/** Real uploaded image or nothing (people, logos — no stock fallback). */
export function OwnImage({ media, alt = "", sizes, className, fit = "cover" }) {
  if (!media?.urls) return null;
  return <SmartImage media={media} alt={alt} sizes={sizes} fit={fit} className={className} />;
}

/** Numbered feature list — "why us", construction standards, promises on light backgrounds. */
export function FeatureList({ items, T, columns = 2 }) {
  const locale = useLocale();
  return (
    <ol className={cn("grid gap-x-10 border-t border-line", columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>
      {items.map((it, i) => {
        const Icon = ICONS[it.icon] ?? Sparkles;
        return (
          <li key={i} data-reveal className="border-b border-line py-7">
            <div className="flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-md border border-line-strong bg-surface">
                <Icon aria-hidden className="size-5 text-accent" strokeWidth={1.4} />
              </span>
              <span className="font-mono text-xs text-ink-subtle">{pad2(i, locale)}</span>
            </div>
            <h3 className="mt-5 text-base font-semibold">{T(it.title)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{T(it.body)}</p>
          </li>
        );
      })}
    </ol>
  );
}

/** Logo wall grouped by kind (approvals, memberships, banks, partners). */
export function LogoGroups({ items }) {
  const t = useTranslations("site.sections.logoGroups");
  const groups = ["approval", "membership", "bank", "partner"]
    .map((g) => ({ g, items: items.filter((i) => i.group === g) }))
    .filter((x) => x.items.length);
  return (
    <div className="space-y-10">
      {groups.map(({ g, items: list }) => (
        <div key={g} data-reveal>
          <p className="caps text-[11px] font-semibold text-ink-muted">{t(g)}</p>
          <ul className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
            {list.map((it, i) => {
              const inner = (
                <>
                  {it.logo ? (
                    <OwnImage
                      media={it.logo}
                      alt={it.name}
                      fit="contain"
                      sizes="160px"
                      className="h-12 w-full bg-transparent opacity-80 grayscale transition group-hover:opacity-100 group-hover:grayscale-0"
                    />
                  ) : (
                    <span className="text-center text-sm font-medium">{it.name}</span>
                  )}
                  {it.logo && it.name && <span className="sr-only">{it.name}</span>}
                </>
              );
              return (
                <li key={i} className="bg-surface">
                  {it.url ? (
                    <a href={it.url} target="_blank" rel="noopener noreferrer" className="group grid h-24 place-items-center px-5">
                      {inner}
                    </a>
                  ) : (
                    <div className="group grid h-24 place-items-center px-5">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Accessible accordion (native details/summary) — no JS needed. */
export function FaqList({ items, T }) {
  return (
    <ul className="divide-y divide-line border-y border-line">
      {items.map((it, i) => (
        <li key={i} data-reveal>
          <details className="group">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-left text-base font-medium marker:hidden [&::-webkit-details-marker]:hidden">
              <span>{T(it.q)}</span>
              <span
                aria-hidden
                className="mt-1 grid size-6 shrink-0 place-items-center rounded-full border border-line-strong text-ink-muted transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <Paragraphs text={T(it.a)} className="max-w-2xl space-y-3 pb-6 text-sm leading-relaxed text-ink-muted" />
          </details>
        </li>
      ))}
    </ul>
  );
}

/** Progress bar with text (never colour alone). */
export function Progress({ percent, dark = false }) {
  const locale = useLocale();
  const t = useTranslations("site.sections.construction");
  if (percent == null) return null;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className={dark ? "text-primary-ink/70" : "text-ink-muted"}>{t("complete")}</span>
        <span className="font-mono font-semibold">{t("percent", { n: formatNumber(percent, locale) })}</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("complete")}
        className={cn("mt-1.5 h-1.5 overflow-hidden rounded-full", dark ? "bg-primary-deep" : "bg-line")}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** Latest site update of a project (home page). */
export function ConstructionCard({ update, T }) {
  const locale = useLocale();
  const t = useTranslations("site.sections.construction");
  const photo = update.photos?.[0]?.media ?? null;
  const project = update.project;
  return (
    <Link href={`/projects/${project.slug}#construction`} className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface">
      <div className="relative aspect-[4/3]">
        <SmartImage
          media={photo ?? project.cover}
          seed={project.slug}
          alt={T(update.title)}
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="absolute inset-0 transition-transform duration-700 group-hover:scale-[1.02]"
        />
        {update.milestone && (
          <span className="absolute top-3 left-3 rounded-sm bg-surface/95 px-2 py-1 text-[11px] font-semibold">{t(`milestones.${update.milestone}`)}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <p className="text-xs text-ink-muted">
            {pick(project, "name", locale)} · <time dateTime={update.date}>{formatDate(update.date, locale, "long")}</time>
          </p>
          <h3 className="mt-1.5 text-base font-semibold group-hover:underline">{T(update.title)}</h3>
        </div>
        <div className="mt-auto">
          <Progress percent={update.percent} />
        </div>
      </div>
    </Link>
  );
}
