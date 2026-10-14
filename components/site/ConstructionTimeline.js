import { getLocale, getTranslations } from "next-intl/server";
import { formatDate, formatNumber } from "@/lib/format";
import { Paragraphs, tx } from "@/lib/public/content";
import { pick } from "@/lib/public/site";
import { PhotoStrip } from "./PhotoStrip";
import { Progress } from "./sections/parts";

/** "Construction progress" on the project page: latest first, % and milestone, photos (B2b). */
export async function ConstructionTimeline({ updates }) {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("site.sections.construction")]);
  const latest = updates[0];
  return (
    <div>
      {latest?.percent != null && (
        <div className="mb-10 max-w-md">
          <Progress percent={latest.percent} />
          <p className="mt-2 text-xs text-ink-muted">{t("lastUpdate", { date: formatDate(latest.date, locale, "long") })}</p>
        </div>
      )}
      <ol className="relative border-l border-line-strong pl-7">
        {updates.map((u) => {
          const title = tx(u.title, locale);
          return (
            <li key={u.id} className="relative pb-12 last:pb-0">
              <span aria-hidden className="absolute top-1.5 -left-[2.06rem] size-2.5 rounded-full bg-accent ring-4 ring-sage-tint" />
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                <time dateTime={u.date} className="font-medium text-ink">
                  {formatDate(u.date, locale, "long")}
                </time>
                {u.milestone && <span className="rounded-sm border border-line-strong px-1.5 py-0.5">{t(`milestones.${u.milestone}`)}</span>}
                {u.percent != null && <span className="font-mono">{t("percent", { n: formatNumber(u.percent, locale) })}</span>}
                {u.block && <span>{pick(u.block, "name", locale)}</span>}
              </p>
              <h3 className="mt-2 text-lg font-semibold">{title}</h3>
              <Paragraphs text={tx(u.body, locale)} className="mt-2 max-w-2xl space-y-3 text-sm leading-relaxed text-ink-muted" />
              <PhotoStrip photos={u.photos.map((p) => ({ media: p.media, caption: tx(p.caption, locale) }))} caption={title} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
