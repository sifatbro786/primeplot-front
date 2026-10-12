"use client";

import { useState } from "react";
import { Map as MapIcon, Plus, Shapes } from "lucide-react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { SmartImage } from "@/components/media/SmartImage";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Tag } from "@/components/ui/Tag";
import { Link } from "@/i18n/navigation";
import { errorMessage, useSession } from "@/lib/auth/session";
import { formatDate, formatNumber } from "@/lib/format";
import { floorLabel } from "@/components/inventory/ElevationGrid";
import { useFloorPlans, useProject } from "@/components/inventory/queries";
import { compressFloors } from "./geometry";
import { PlanMetaDrawer } from "./PlanMetaDrawer";

function PlanCard({ plan, project }) {
  const t = useTranslations("plans");
  const ti = useTranslations("inventory");
  const locale = useLocale();
  const title = locale === "bn" && plan.titleBn ? plan.titleBn : plan.title;
  return (
    <Link
      href={`/dashboard/projects/${project.id}/plans/${plan.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-line-strong"
    >
      <SmartImage
        media={plan.image}
        variant="card"
        sizes="(min-width: 1024px) 30vw, 100vw"
        fit="contain"
        className="aspect-[16/10] border-b border-line bg-surface-2"
        imgClassName="p-3 transition-transform duration-300 group-hover:scale-[1.02]"
      />
      <div className="flex flex-1 flex-col gap-2 px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <h4 className="text-sm leading-snug font-semibold">{title}</h4>
          {plan.hotspotCount === 0 ? <Tag tone="warning">{t("noAreas")}</Tag> : <Tag>{t("areas", { n: plan.hotspotCount, count: formatNumber(plan.hotspotCount, locale) })}</Tag>}
        </div>
        {plan.kind === "floor" && (
          <p className="font-mono text-xs text-ink-muted">
            {t("floorsShort")} {compressFloors(plan.floors, (f) => floorLabel(f, locale, ti))}
          </p>
        )}
        <p className="mt-auto text-[11px] text-ink-subtle">{t("updated", { at: formatDate(plan.updatedAt, locale) })}</p>
      </div>
    </Link>
  );
}

function Group({ title, note, children }) {
  return (
    <section className="space-y-4">
      <header className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {note && <span className="text-xs text-ink-muted">{note}</span>}
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

/** Plans tab: site/master plans and (typical) floor plans per building. */
export function PlansTab() {
  const { id } = useParams();
  const t = useTranslations("plans");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const { can } = useSession();
  const { data: project } = useProject(id);
  const plans = useFloorPlans(id);
  const [meta, setMeta] = useState(null);

  if (!project || plans.isPending) return <Skeleton className="h-96 w-full" />;
  if (plans.isError) {
    return (
      <ErrorState
        title={t("loadFailed")}
        description={errorMessage(te, plans.error)}
        requestId={plans.error?.requestId}
        requestIdLabel={tc("requestId")}
        action={
          <Button size="sm" variant="secondary" onClick={() => plans.refetch()}>
            {tc("retry")}
          </Button>
        }
      />
    );
  }

  const list = plans.data ?? [];
  const canWrite = can("projects:write");
  const masters = list.filter((p) => p.kind === "master");
  const byBlock = (project.blocks ?? [])
    .map((b) => ({ block: b, plans: list.filter((p) => p.kind === "floor" && p.blockId === b.id) }))
    .filter((g) => g.plans.length);
  const add = canWrite && (
    <Button size="sm" onClick={() => setMeta({})}>
      <Plus aria-hidden className="size-3.5" />
      {t("new")}
    </Button>
  );

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-2xl text-sm leading-relaxed text-ink-muted">{t(project.kind === "plot" ? "introPlot" : "intro")}</p>
        {list.length > 0 && add}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={project.kind === "plot" ? MapIcon : Shapes} title={t("emptyTitle")} description={t(project.kind === "plot" ? "emptyBodyPlot" : "emptyBody")} action={add} />
      ) : (
        <>
          {masters.length > 0 && (
            <Group title={t(project.kind === "plot" ? "layoutPlans" : "sitePlans")}>
              {masters.map((p) => (
                <PlanCard key={p.id} plan={p} project={project} />
              ))}
            </Group>
          )}
          {byBlock.map(({ block, plans: ps }) => (
            <Group
              key={block.id}
              title={t("floorPlansOf", { name: locale === "bn" && block.nameBn ? block.nameBn : block.name })}
              note={t("plansCount", { n: ps.length, count: formatNumber(ps.length, locale) })}
            >
              {ps.map((p) => (
                <PlanCard key={p.id} plan={p} project={project} />
              ))}
            </Group>
          ))}
        </>
      )}

      <PlanMetaDrawer state={meta} project={project} onClose={() => setMeta(null)} />
    </div>
  );
}
