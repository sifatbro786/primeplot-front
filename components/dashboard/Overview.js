"use client";

import { ArrowRight, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/States";
import { Tag } from "@/components/ui/Tag";
import { Link } from "@/i18n/navigation";
import { useSession } from "@/lib/auth/session";

/**
 * First screen after login. No invented numbers: until inventory/CRM data exists (B2/B3) this
 * is a short setup checklist; KPIs replace it in F6.
 */
export function Overview() {
  const t = useTranslations("overview");
  const { user, org, can, isPending } = useSession();

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const steps = [
    { key: "org", href: "/dashboard/settings", show: can("org:update"), done: Boolean(org?.phone && org?.address) },
    { key: "team", href: "/dashboard/users", show: can("users:manage") },
    { key: "project", href: "/dashboard/projects", show: can("projects:write") },
    { key: "leads", href: "/dashboard/leads", show: can("leads:read_own", "leads:read_all") },
  ].filter((s) => s.show);

  return (
    <div className="mx-auto max-w-5xl">
      <header>
        <span className="eyebrow">{org?.name}</span>
        <h2 className="mt-4 font-display text-4xl leading-tight md:text-5xl">{t("welcome", { name: user?.name?.split(" ")[0] ?? "" })}</h2>
        <p className="mt-3 max-w-xl text-ink-muted">{t("intro")}</p>
      </header>

      {steps.length > 0 && (
        <section className="mt-12">
          <h3 className="mb-4 text-xs font-semibold tracking-[0.12em] text-ink-muted uppercase">{t("setupTitle")}</h3>
          <ol className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {steps.map((s, i) => (
              <li key={s.key}>
                <Link href={s.href} className="group flex items-center gap-5 px-5 py-5 transition-colors hover:bg-canvas">
                  <span className="grid size-9 shrink-0 place-items-center rounded-md border border-line font-mono text-xs text-ink-muted">
                    {s.done ? <Check aria-hidden className="size-4 text-success" /> : String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      {t(`steps.${s.key}.title`)}
                      {s.done && <Tag tone="success">{t("done")}</Tag>}
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-muted">{t(`steps.${s.key}.body`)}</span>
                  </span>
                  <ArrowRight aria-hidden className="size-4 text-ink-subtle transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
