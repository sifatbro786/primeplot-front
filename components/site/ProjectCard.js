import { ArrowUpRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { SmartImage } from "@/components/media/SmartImage";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatBDTCompact, formatDate, formatLand } from "@/lib/format";
import { pick } from "@/lib/public/site";
import { InventoryStrip } from "./InventoryStrip";

const imageCategory = (p) => (p.kind === "plot" ? "plot-land" : "apartment-exterior");

// The API stores the city in English only; the common ones read better in Bangla.
const BN_CITY = {
  dhaka: "ঢাকা", chattogram: "চট্টগ্রাম", chittagong: "চট্টগ্রাম", sylhet: "সিলেট", khulna: "খুলনা", rajshahi: "রাজশাহী",
  gazipur: "গাজীপুর", narayanganj: "নারায়ণগঞ্জ", cumilla: "কুমিল্লা", comilla: "কুমিল্লা", barishal: "বরিশাল",
  rangpur: "রংপুর", mymensingh: "ময়মনসিংহ", "cox's bazar": "কক্সবাজার", savar: "সাভার", keraniganj: "কেরানীগঞ্জ",
};

/** "Banani, Dhaka" in the page language. */
export function placeOf(location, locale) {
  if (!location) return "";
  const city = location.city && locale === "bn" ? (BN_CITY[location.city.trim().toLowerCase()] ?? location.city) : location.city;
  return [pick(location, "area", locale), city].filter(Boolean).join(", ");
}

function PriceLine({ project, className }) {
  const t = useTranslations("site.card");
  const locale = useLocale();
  const from = project.inventory?.priceFrom;
  return (
    <p className={cn("text-sm", className)}>
      {from != null ? (
        t.rich("from", {
          price: formatBDTCompact(from, locale),
          b: (chunks) => <span className="font-mono font-medium text-ink">{chunks}</span>,
        })
      ) : (
        <span className="text-ink-muted">{t("priceOnRequest")}</span>
      )}
    </p>
  );
}

function StageLabel({ stage, className }) {
  const t = useTranslations("projects.stages");
  return (
    <span className={cn("inline-flex h-6 items-center rounded-sm bg-surface/95 px-2 text-[10px] font-semibold caps text-ink ", className)}>
      {t(stage)}
    </span>
  );
}

/** Grid card: image · place + kind · name · tagline · stock strip · from-price. The whole card is one link. */
export function ProjectCard({ project, priority = false }) {
  const t = useTranslations("site.card");
  const locale = useLocale();
  const name = pick(project, "name", locale);
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-line-strong/60">
      <div className="relative aspect-[4/3]">
        <SmartImage
          media={project.cover}
          category={imageCategory(project)}
          seed={project.id}
          alt={name}
          preload={priority}
          sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw"
          className="absolute inset-0"
          imgClassName="transition-transform duration-700 ease-(--ease-out-quint) group-hover:scale-[1.03]"
        />
        <StageLabel stage={project.stage} className="absolute top-3 left-3" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="flex items-center justify-between gap-3 text-[10px] font-semibold caps text-accent ">
          <span className="truncate">{placeOf(project.location, locale)}</span>
          <span className="shrink-0 text-ink-subtle">{t(project.kind === "plot" ? "kindPlot" : "kindApartment")}</span>
        </p>
        <h3 className="mt-2.5 font-display text-2xl leading-tight">
          <Link href={`/projects/${project.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none after:focus-visible:outline-2 after:focus-visible:outline-focus">
            {name}
          </Link>
        </h3>
        {pick(project, "tagline", locale) && <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">{pick(project, "tagline", locale)}</p>}
        <div className="mt-auto pt-6">
          <InventoryStrip inventory={project.inventory} />
          <div className="mt-4 flex items-end justify-between gap-3 border-t border-line pt-4">
            <PriceLine project={project} />
            <ArrowUpRight aria-hidden className="size-4 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink" />
          </div>
        </div>
      </div>
    </article>
  );
}

/** Wide editorial row for featured projects: facts on the left, a big image on the right. */
export function FeaturedProjectRow({ project, priority = false, flip = false }) {
  const t = useTranslations("site.card");
  const tf = useTranslations("site.facts");
  const ts = useTranslations("projects.stages");
  const locale = useLocale();
  const name = pick(project, "name", locale);
  const facts = [
    project.landArea && { k: tf("land"), v: formatLand(project.landArea, locale) },
    project.handoverAt && { k: tf("handover"), v: formatDate(project.handoverAt, locale, "date") },
  ].filter(Boolean);

  return (
    <article className="group relative grid overflow-hidden rounded-lg border border-line bg-surface md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className={cn("flex flex-col p-6 sm:p-8", flip && "md:order-2")}>
        <p className="eyebrow">{t("featured")}</p>
        <h3 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
          <Link href={`/projects/${project.slug}`} className="after:absolute after:inset-0 focus-visible:outline-none after:focus-visible:outline-2 after:focus-visible:outline-focus">
            {name}
          </Link>
        </h3>
        <p className="mt-2 text-sm text-ink-muted">{placeOf(project.location, locale)}</p>
        {pick(project, "tagline", locale) && <p className="mt-5 max-w-md text-sm leading-relaxed">{pick(project, "tagline", locale)}</p>}

        <dl className="mt-6 divide-y divide-line border-y border-line text-sm">
          <div className="flex justify-between gap-4 py-2.5">
            <dt className="text-ink-muted">{tf("stage")}</dt>
            <dd>{ts(project.stage)}</dd>
          </div>
          {facts.map((f) => (
            <div key={f.k} className="flex justify-between gap-4 py-2.5">
              <dt className="text-ink-muted">{f.k}</dt>
              <dd className="text-right">{f.v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-auto pt-8">
          <InventoryStrip inventory={project.inventory} />
          <div className="mt-4 flex items-end justify-between gap-3">
            <PriceLine project={project} className="text-base" />
            <span className="inline-flex items-center gap-1.5 text-xs font-medium caps ">
              {t("view")}
              <ArrowUpRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </div>
        </div>
      </div>
      <div className={cn("relative min-h-64 md:min-h-[26rem]", flip && "md:order-1")}>
        <SmartImage
          media={project.cover}
          category={imageCategory(project)}
          seed={project.id}
          alt={name}
          preload={priority}
          sizes="(min-width: 768px) 58vw, 100vw"
          className="absolute inset-0"
          imgClassName="transition-transform duration-700 ease-(--ease-out-quint) group-hover:scale-[1.02]"
        />
      </div>
    </article>
  );
}
