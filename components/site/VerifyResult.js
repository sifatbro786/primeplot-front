import { BadgeCheck, CircleSlash, SearchX } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { formatBDT, formatDate } from "@/lib/format";
import { verifyDocument } from "@/lib/public/api";

const pickName = (o, locale) => (o ? (locale === "bn" && o.nameBn ? o.nameBn : o.name) : null);

/** /verify/[token] — what the QR code on a receipt or letter opens. Server-rendered, uncached. */
export async function VerifyResult({ params }) {
  const { token } = await params;
  const [locale, t, td] = await Promise.all([getLocale(), getTranslations("site.verify"), getTranslations("site.verify.types")]);
  const r = await verifyDocument(token);
  const state = !r ? "unknown" : r.valid ? "valid" : "void";
  const Icon = { valid: BadgeCheck, void: CircleSlash, unknown: SearchX }[state];
  const day = (d) => (d ? formatDate(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T06:00:00Z` : d, locale, "long") : "—");

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-14 sm:py-20">
      <p className="eyebrow">{t("eyebrow")}</p>
      <div
        className={cn("mt-5 rounded-lg border bg-surface p-6 sm:p-8", state === "valid" && "border-success/40", state === "void" && "border-danger/40", state === "unknown" && "border-line-strong")}
      >
        <div className="flex items-start gap-4">
          <span
            className={cn(
              "grid size-12 shrink-0 place-items-center rounded-full",
              state === "valid" && "bg-success-bg text-success",
              state === "void" && "bg-danger-bg text-danger",
              state === "unknown" && "bg-surface-2 text-ink-muted",
            )}
          >
            <Icon aria-hidden className="size-6" strokeWidth={1.6} />
          </span>
          <div>
            <h1 className="font-display text-3xl leading-tight">{t(`${state}.title`)}</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{state === "void" ? t("void.body", { reason: r.voidReason ?? "—" }) : t(`${state}.body`)}</p>
          </div>
        </div>

        {r && (
          <dl className="mt-8 grid gap-x-6 gap-y-5 border-t border-line pt-6 sm:grid-cols-2">
            <Item label={t("fields.type")}>{td.has(r.type) ? td(r.type) : r.type}</Item>
            <Item label={t("fields.number")} mono>
              {r.number}
            </Item>
            <Item label={t("fields.date")}>{day(r.date)}</Item>
            <Item label={t("fields.issuer")}>{pickName(r.organization, locale)}</Item>
            <Item label={t("fields.project")}>{pickName(r.project, locale)}</Item>
            <Item label={t("fields.unit")} mono>
              {r.unitCode}
            </Item>
            <Item label={t("fields.holder")}>{r.holder}</Item>
            {r.amount != null && (
              <Item label={t("fields.amount")} mono>
                {formatBDT(r.amount, locale)}
              </Item>
            )}
            <Item label={t("fields.fingerprint")} mono className="sm:col-span-2">
              {r.fingerprint}
            </Item>
          </dl>
        )}
      </div>
      {r && <p className="mt-5 text-xs leading-relaxed text-ink-muted">{t("note")}</p>}
      <Button as={Link} href="/" variant="secondary" size="sm" className="mt-6">
        {t("home")}
      </Button>
    </section>
  );
}

function Item({ label, children, mono, className }) {
  return (
    <div className={className}>
      <dt className="text-[11px] font-medium tracking-wide text-ink-subtle uppercase">{label}</dt>
      <dd className={cn("mt-1 text-sm break-words", mono && "font-mono text-[13px]")}>{children ?? "—"}</dd>
    </div>
  );
}
