"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { Link } from "@/i18n/navigation";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { useProjectOptions } from "@/lib/crm/queries";
import { formatLand, formatSqftArea } from "@/lib/format";
import { localName, useMoney } from "../parts";

/** Can this user book the unit right now? (available, an expired hold, own hold, or anyone's with units:write) */
export function bookable(unit, user, can) {
  if (!unit) return false;
  if (unit.status === "available") return true;
  if (unit.status !== "held") return false;
  if (unit.hold?.until && new Date(unit.hold.until) <= new Date()) return true;
  return unit.hold?.by === user?.id || can("units:write");
}

export function unitFacts(u, locale) {
  if (!u) return "";
  if (u.kind === "plot") return [u.road, u.landArea && formatLand(u.landArea, locale)].filter(Boolean).join(" · ");
  return [u.typeLabel, u.saleableSqft != null && formatSqftArea(u.saleableSqft, null, locale)].filter(Boolean).join(" · ");
}

/** Minutes left on a hold, ticking once a minute (null when there is no hold). */
export function useHoldLeft(until) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return undefined;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [until]);
  return until ? Math.floor((new Date(until).getTime() - now) / 60_000) : null;
}

/** Warning strip for the chosen unit: someone else's hold, hold running out, or no longer bookable. */
export function UnitWatch({ unit, onChange }) {
  const t = useTranslations("sales.wizard.unit");
  const { user, can } = useSession();
  const left = useHoldLeft(unit?.status === "held" ? unit.hold?.until : null);
  if (!unit) return null;
  const ok = bookable(unit, user, can);
  if (!ok) {
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-danger/30 bg-danger-bg px-4 py-3 text-sm">
        <AlertTriangle aria-hidden className="size-4 text-danger" />
        <span className="flex-1">{t("gone", { code: unit.code })}</span>
        {onChange && (
          <Button size="sm" variant="secondary" onClick={onChange}>
            {t("pickAnother")}
          </Button>
        )}
      </div>
    );
  }
  if (unit.status === "held" && unit.hold?.by !== user?.id && left > 0) {
    return <p className="rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-sm">{t("heldByOther", { name: unit.hold?.byName ?? "—" })}</p>;
  }
  if (unit.status === "held" && left != null && left > 0) {
    return (
      <p className={cn("flex items-center gap-2 rounded-md px-4 py-3 text-sm", left <= 15 ? "border border-warning/30 bg-warning-bg" : "bg-surface-2 text-ink-muted")}>
        <Clock aria-hidden className="size-4" />
        {t("holdLeft", { min: left })}
      </p>
    );
  }
  return null;
}

export function StepUnit({ draft, patch, units: unitsQuery }) {
  const t = useTranslations("sales.wizard.unit");
  const locale = useLocale();
  const money = useMoney();
  const { user, can } = useSession();
  const projects = useProjectOptions();
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);
  const project = (projects.data ?? []).find((p) => p.id === draft.projectId);

  const rows = useMemo(() => {
    const all = unitsQuery.data ?? [];
    const needle = q.trim().toLowerCase();
    return all
      .filter((u) => showAll || bookable(u, user, can) || u.id === draft.unitId)
      .filter((u) => !needle || u.code.toLowerCase().includes(needle) || (u.plotNo ?? "").toLowerCase().includes(needle));
  }, [unitsQuery.data, q, showAll, user, can, draft.unitId]);

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-[1fr_1fr]">
        <Field label={t("project")} required>
          <Select value={draft.projectId} onChange={(e) => patch({ projectId: e.target.value, unitId: "", planId: "", schedule: [] })} placeholder={t("chooseProject")}>
            {(projects.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {localName(p, locale)}
                {p.code ? ` · ${p.code}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        {draft.projectId && (
          <Field label={t("search")}>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} leading={<Search className="size-4" />} />
          </Field>
        )}
      </div>

      {project && !project.code && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-warning/30 bg-warning-bg px-4 py-3 text-sm">
          <AlertTriangle aria-hidden className="size-4 text-warning" />
          <span className="flex-1">{t("noCode")}</span>
          {can("projects:write") && (
            <Button as={Link} href={`/dashboard/projects/${project.id}/sales`} size="sm" variant="secondary">
              {t("setCode")}
            </Button>
          )}
        </div>
      )}

      {draft.projectId &&
        (unitsQuery.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs text-ink-muted">{t("count", { n: rows.length })}</p>
              <label className="flex items-center gap-2 text-xs text-ink-muted">
                <input type="checkbox" className="size-3.5 accent-primary" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
                {t("showAll")}
              </label>
            </div>
            {rows.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line-strong/60 px-5 py-10 text-center text-sm text-ink-muted">{t("none")}</p>
            ) : (
              <ul className="grid max-h-[28rem] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4" role="listbox" aria-label={t("units")}>
                {rows.map((u) => {
                  const ok = bookable(u, user, can);
                  const selected = u.id === draft.unitId;
                  return (
                    <li key={u.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        disabled={!ok}
                        onClick={() => patch({ unitId: u.id })}
                        className={cn(
                          "flex h-full w-full flex-col items-start gap-1.5 rounded-md border px-3 py-2.5 text-left transition-colors",
                          selected ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface enabled:hover:border-line-strong",
                          !ok && "cursor-not-allowed opacity-55",
                        )}
                      >
                        <span className="flex w-full items-center justify-between gap-2">
                          <span className="font-mono text-sm font-semibold">{u.code}</span>
                          {u.status !== "available" && <StatusChip status={u.status} size="sm" className={selected ? "border-transparent" : undefined} />}
                        </span>
                        <span className={cn("text-[11px] leading-snug", selected ? "text-primary-ink/80" : "text-ink-muted")}>{unitFacts(u, locale) || "—"}</span>
                        <span className="font-mono text-[12px] tabular-nums">{u.listPrice != null ? money(u.listPrice) : t("noPrice")}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
    </div>
  );
}
