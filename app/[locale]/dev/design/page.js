import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, BedDouble, MapPin, Ruler } from "lucide-react";
import { LocaleSwitcher } from "@/components/i18n/LocaleSwitcher";
import { SmartImage } from "@/components/media/SmartImage";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { StatusChip } from "@/components/ui/StatusChip";
import { UNIT_STATUSES } from "@/lib/unitStatus";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { formatBDT, formatBDTCompact, formatDate, formatNumber, formatPhone, formatSft, localizeDigits } from "@/lib/format";
import { ControlsDemo, FeedbackDemo } from "./Demos";

// Living style guide — the owner approves the system here before pages are built.
// Development only: hidden in production builds.
export const metadata = { title: "Design system", robots: { index: false } };

const SWATCHES = [
  ["canvas", "#F9F8F6", "bg-canvas", "Page background"],
  ["surface", "#FFFFFF", "bg-surface", "Cards, panels, tables"],
  ["surface-2", "#F1EFEA", "bg-surface-2", "Table head, sunken"],
  ["ink", "#1C1D1A", "bg-ink", "Primary text · 15.9"],
  ["ink-muted", "#666861", "bg-ink-muted", "Secondary text · 5.3"],
  ["line", "#E5E3DF", "bg-line", "Hairlines"],
  ["line-strong", "#8F8C82", "bg-line-strong", "Control borders · 3.2"],
  ["primary", "#2D3228", "bg-primary", "Buttons, sidebar"],
  ["accent", "#6B705C", "bg-accent", "Sage — links, active · 4.8"],
  ["accent-soft", "#F3F4EF", "bg-accent-soft", "Selected rows"],
];

const TYPOLOGIES = [
  { beds: 2, sft: 1150, price: 8_500_000_00 },
  { beds: 3, sft: 1450, price: 11_250_000_00 },
  { beds: 4, sft: 2100, price: 16_800_000_00 },
];

const UNITS = [
  { code: "A-12-03", floor: 12, sft: 1450, price: 11_890_000_00, status: "available" },
  { code: "A-12-04", floor: 12, sft: 1150, price: 9_120_000_00, status: "held" },
  { code: "A-11-01", floor: 11, sft: 2100, price: 17_250_000_00, status: "booked" },
  { code: "A-10-02", floor: 10, sft: 1450, price: 11_400_000_00, status: "allotted" },
  { code: "A-03-01", floor: 3, sft: 2100, price: 0, status: "blocked" },
];

// Elevation grid: floors (top → bottom) × 4 units. Deterministic demo pattern.
const GRID_STATUS = ["available", "booked", "allotted", "held", "available", "blocked", "registered", "available"];

function Section({ n, title, children }) {
  return (
    <section className="grid gap-8 border-t border-line py-14 md:grid-cols-[200px_1fr]">
      <header>
        <p className="font-mono text-xs text-ink-subtle">{String(n).padStart(2, "0")}</p>
        <h2 className="mt-1 text-sm font-semibold tracking-wide">{title}</h2>
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default async function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const t = await getTranslations("design");
  const locale = await getLocale();
  const other = locale === "bn" ? "en" : "bn";

  return (
    <div className="flex-1">
      {/* ── Top bar ── */}
      <div className="border-b border-line bg-canvas/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <p className="text-[13px] font-semibold tracking-[0.32em]">
            PRIMEPLOT <span className="ml-2 font-normal tracking-normal text-ink-subtle">/ dev / design</span>
          </p>
          <LocaleSwitcher />
        </div>
      </div>

      {/* ── Hero: copy left, diagonal image right ── */}
      <div className="relative overflow-hidden border-b border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-[1.05fr_1fr] md:py-24">
          <div className="flex flex-col justify-center">
            <span className="eyebrow">{t("eyebrow")}</span>
            <h1 className="mt-6 font-display text-5xl leading-[1.05] font-normal md:text-6xl">{t("title")}</h1>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ink-muted">{t("intro")}</p>
          </div>
          <SmartImage
            category="house"
            seed="design-hero"
            alt=""
            preload
            sizes="(min-width: 768px) 50vw, 100vw"
            className="aspect-[4/3] md:aspect-auto md:min-h-[420px] md:[clip-path:polygon(18%_0,100%_0,100%_100%,0_100%)]"
          />
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        {/* 01 Colour */}
        <Section n={1} title={t("colors")}>
          <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
            {SWATCHES.map(([name, hex, cls, role]) => (
              <li key={name} className="bg-surface p-3">
                <span className={`block h-16 rounded-sm border border-line ${cls}`} />
                <p className="mt-3 text-xs font-semibold">{name}</p>
                <p className="font-mono text-[11px] text-ink-muted">{hex}</p>
                <p className="mt-1 text-[11px] leading-snug text-ink-subtle">{role}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Tag tone="success">success</Tag>
            <Tag tone="warning">warning</Tag>
            <Tag tone="danger">danger</Tag>
            <Tag tone="info">info</Tag>
            <Tag tone="accent">accent</Tag>
            <Tag tone="outline">outline</Tag>
          </div>
        </Section>

        {/* 02 Typography */}
        <Section n={2} title={t("type")}>
          <div className="space-y-8">
            <div>
              <p className="mb-2 font-mono text-[11px] text-ink-subtle">Display · Playfair Display / Noto Serif Bengali · ≥28px</p>
              <p className="font-display text-5xl leading-tight">Architecture that elevates <em className="text-accent">life.</em></p>
              <p lang="bn" className="mt-2 font-display text-4xl leading-snug">জীবনকে উন্নত করে যে স্থাপত্য।</p>
            </div>
            <div>
              <p className="mb-2 font-mono text-[11px] text-ink-subtle">Heading · Plus Jakarta Sans 600</p>
              <p className="text-2xl font-semibold tracking-tight">{t("headingSample")}</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="mb-2 font-mono text-[11px] text-ink-subtle">Body · Plus Jakarta Sans 400 / 15px</p>
                <p lang="en" className="text-[15px] leading-relaxed text-ink-muted">
                  PrimePlot keeps every unit, lead and installment in one place, so your sales team always knows what is
                  available and what is due.
                </p>
              </div>
              <div>
                <p className="mb-2 font-mono text-[11px] text-ink-subtle">Body · Hind Siliguri 400 / 15px</p>
                <p lang="bn" className="text-[15px] text-ink-muted">
                  প্রাইমপ্লট প্রতিটি ইউনিট, লিড আর কিস্তি এক জায়গায় রাখে, যাতে সেলস টিম সবসময় জানে কোনটি খালি আর কোনটি বকেয়া।
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-8">
              <span className="eyebrow">Featured projects</span>
              <span className="font-mono text-sm">A-12-03 · RCPT-2026-000418</span>
            </div>
          </div>
        </Section>

        {/* 03 Numbers & money */}
        <Section n={3} title={t("numbers")}>
          <dl className="divide-y divide-line rounded-lg border border-line bg-surface">
            {[
              ["formatBDT(1255000000)", formatBDT(1255000000, locale), formatBDT(1255000000, other)],
              ["formatBDT(1234550)", formatBDT(1234550, locale), formatBDT(1234550, other)],
              ["formatBDTCompact(1125000000)", formatBDTCompact(1125000000, locale), formatBDTCompact(1125000000, other)],
              ["formatBDTCompact(850000000)", formatBDTCompact(850000000, locale), formatBDTCompact(850000000, other)],
              ["formatSft(1450)", formatSft(1450, locale), formatSft(1450, other)],
              ["formatDate(…)", formatDate("2027-06-30T18:00:00Z", locale, "long"), formatDate("2027-06-30T18:00:00Z", other, "long")],
              ["formatPhone(+8801712345678)", formatPhone("+8801712345678", locale), formatPhone("+8801712345678", other)],
            ].map(([fn, a, b]) => (
              <div key={fn} className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[1.2fr_1fr_1fr] sm:items-center">
                <dt className="font-mono text-[11px] text-ink-subtle">{fn}</dt>
                <dd className="font-mono text-sm tabular-nums">{a}</dd>
                <dd className="font-mono text-sm text-ink-muted tabular-nums">{b}</dd>
              </div>
            ))}
          </dl>
        </Section>

        {/* 04 Controls */}
        <Section n={4} title={t("controls")}>
          <ControlsDemo />
        </Section>

        {/* 05 Unit status */}
        <Section n={5} title={t("status")}>
          <div className="flex flex-wrap gap-2">
            {UNIT_STATUSES.map((s) => (
              <StatusChip key={s} status={s} />
            ))}
          </div>
          <div className="blueprint mt-8 inline-block rounded-lg border border-line p-5">
            <p className="mb-3 font-mono text-[11px] text-ink-subtle">Tower A · elevation</p>
            <div className="grid grid-cols-[auto_repeat(4,56px)] gap-1">
              {[14, 13, 12, 11, 10, 9].map((floor, fi) => (
                <div key={floor} className="contents">
                  <span className="pr-2 text-right font-mono text-[11px] leading-[32px] text-ink-subtle">
                    {localizeDigits(String(floor).padStart(2, "0"), locale)}
                  </span>
                  {[1, 2, 3, 4].map((u, ui) => {
                    const s = GRID_STATUS[(fi * 3 + ui * 5) % GRID_STATUS.length];
                    const cls = {
                      available: "bg-status-available/12 border-status-available/50",
                      held: "bg-status-held/14 border-status-held/50",
                      booked: "bg-status-booked/14 border-status-booked/50",
                      allotted: "bg-status-sold/14 border-status-sold/50",
                      registered: "bg-status-sold/14 border-status-sold/50",
                      blocked: "hatch border-status-blocked/50",
                    }[s];
                    return (
                      <span
                        key={u}
                        title={s}
                        className={`grid h-8 place-items-center rounded-sm border font-mono text-[10px] text-ink ${cls}`}
                      >
                        {floor}0{u}
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* 06 Imagery / project row */}
        <Section n={6} title={t("projectCard")}>
          <article className="grid overflow-hidden rounded-lg border border-line bg-surface md:grid-cols-[1fr_1.1fr]">
            <div className="flex flex-col p-6 md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-3xl leading-tight">{t("projectName")}</h3>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
                    <MapPin aria-hidden className="size-3.5" />
                    {t("projectArea")}
                  </p>
                </div>
                <Tag tone="accent">{t("handover", { year: localizeDigits(2027, locale) })}</Tag>
              </div>
              <p className="mt-5 border-t border-line pt-5 text-sm leading-relaxed text-ink-muted">{t("projectBlurb")}</p>
              <ul className="mt-6 divide-y divide-line border-y border-line text-sm">
                {TYPOLOGIES.map((ty) => (
                  <li key={ty.beds} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="flex items-center gap-4 text-ink-muted">
                      <span className="flex w-16 items-center gap-1.5 text-ink">
                        <BedDouble aria-hidden className="size-3.5 text-accent" />
                        {t("typology", { beds: localizeDigits(ty.beds, locale) })}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Ruler aria-hidden className="size-3.5" />
                        {formatSft(ty.sft, locale)}
                      </span>
                    </span>
                    <span className="font-mono text-[13px] tabular-nums">
                      <span className="mr-1 font-sans text-xs text-ink-subtle">{t("from")}</span>
                      {formatBDTCompact(ty.price, locale)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                <Button variant="secondary">
                  {t("viewProject")}
                  <ArrowRight aria-hidden className="size-4" />
                </Button>
              </div>
            </div>
            <SmartImage category="apartment-exterior" seed="shapla" alt="" sampleBadge className="min-h-[300px]" sizes="(min-width: 768px) 55vw, 100vw" />
          </article>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {["interior", "plot-land", "amenity"].map((c) => (
              <figure key={c} className="overflow-hidden rounded-lg border border-line bg-surface">
                <SmartImage category={c} seed={c} alt="" sampleBadge className="aspect-[4/3]" sizes="(min-width: 640px) 33vw, 100vw" />
                <figcaption className="px-4 py-3 font-mono text-[11px] text-ink-muted">{c}</figcaption>
              </figure>
            ))}
          </div>
        </Section>

        {/* 07 Table */}
        <Section n={7} title={t("table")}>
          <Table>
            <THead>
              <tr>
                <TH>{t("unit")}</TH>
                <TH>{t("floor")}</TH>
                <TH align="right">{t("size")}</TH>
                <TH align="right">{t("price")}</TH>
                <TH>{t("statusCol")}</TH>
              </tr>
            </THead>
            <TBody>
              {UNITS.map((u) => (
                <TR key={u.code}>
                  <TD className="font-mono text-[13px]">{u.code}</TD>
                  <TD>{formatNumber(u.floor, locale)}</TD>
                  <TD numeric>{formatSft(u.sft, locale)}</TD>
                  <TD numeric>{u.price ? formatBDT(u.price, locale) : "—"}</TD>
                  <TD>
                    <StatusChip status={u.status} size="sm" />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Section>

        {/* 08 Feedback */}
        <Section n={8} title={t("feedback")}>
          <FeedbackDemo />
        </Section>
      </main>
    </div>
  );
}
