"use client";

import { useEffect, useState } from "react";
import { Lock, Rows3, Tags } from "lucide-react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { FormAlert } from "@/components/auth/AuthParts";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { toast } from "@/components/ui/Toast";
import { Link } from "@/i18n/navigation";
import { apiRequest } from "@/lib/api/client";
import { errorMessage, useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { useDebounced } from "@/lib/hooks/useDebounced";
import { areaUnitLabel, formatAreaValue, formatBDT, formatNumber, poishaToTaka, takaToPoisha } from "@/lib/format";
import { SOLD_STATUSES } from "@/lib/unitStatus";
import { floorLabel } from "@/components/inventory/ElevationGrid";
import { keys, useBlockUnits, useProject } from "@/components/inventory/queries";

/**
 * Price matrix (POST /projects/:id/units/prices): per-unit rate overrides and one-off
 * adjustments for a whole building/sector at once. Edits stay local (with a live dry-run
 * preview of the new list prices) until Save, which is all-or-nothing on the server.
 */
const MAX_BATCH = 500;
const isSold = (u) => SOLD_STATUSES.includes(u.status);
const empty = (u) => ({
  rate: poishaToTaka(u.rateOverride),
  adj: poishaToTaka(u.priceAdjustment?.amount ?? null),
  note: u.priceAdjustment?.note ?? "",
});

/** Draft strings → { ok, rateOverride, priceAdjustment } in poisha (null = none). */
function parse(d) {
  const rate = d.rate.trim() === "" ? null : takaToPoisha(d.rate);
  const adj = d.adj.trim() === "" ? null : takaToPoisha(d.adj);
  const rateOk = d.rate.trim() === "" || (rate !== null && rate >= 0);
  const adjOk = d.adj.trim() === "" || adj !== null;
  return {
    ok: rateOk && adjOk && d.note.length <= 200,
    rateOk,
    adjOk,
    rateOverride: rate,
    priceAdjustment: adj ? { amount: adj, ...(d.note.trim() && { note: d.note.trim() }) } : null,
  };
}

/** The API item for a changed row, or null when the row matches the saved unit. */
function itemOf(u, d) {
  if (!d) return null;
  const p = parse(d);
  if (!p.ok) return null;
  const item = { id: u.id, version: u.version };
  if (p.rateOverride !== (u.rateOverride ?? null)) item.rateOverride = p.rateOverride;
  const cur = u.priceAdjustment ? { amount: u.priceAdjustment.amount, ...(u.priceAdjustment.note && { note: u.priceAdjustment.note }) } : null;
  if (JSON.stringify(p.priceAdjustment) !== JSON.stringify(cur)) item.priceAdjustment = p.priceAdjustment;
  return Object.keys(item).length > 2 ? item : null;
}

function Matrix({ project, block, onDirty }) {
  const t = useTranslations("priceMatrix");
  const ti = useTranslations("inventory");
  const te = useTranslations("errors");
  const locale = useLocale();
  const qc = useQueryClient();
  const { can } = useSession();
  const canEdit = can("pricing:write");
  const units = useBlockUnits(project.id, block.id);
  const plot = project.kind === "plot";
  const pr = project.pricing ?? {};
  const rateUnit = plot ? (pr.rateUnit ?? "katha") : "sqft";
  const cardRate = plot ? (pr.rate ?? null) : (pr.ratePerSqft ?? null);
  const unitLabel = areaUnitLabel(rateUnit, locale);

  const [drafts, setDrafts] = useState({}); // id → { rate, adj, note }
  const [selected, setSelected] = useState(() => new Set());
  const [anchor, setAnchor] = useState(null);
  const [show, setShow] = useState("all");
  const [bulk, setBulk] = useState({ mode: "rate", value: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const list = units.data ?? [];
  const draftOf = (u) => drafts[u.id] ?? empty(u);
  const items = list.map((u) => itemOf(u, drafts[u.id])).filter(Boolean);
  const invalid = list.filter((u) => drafts[u.id] && !parse(drafts[u.id]).ok).length;
  const changedIds = new Set(items.map((i) => i.id));
  const dirty = Object.keys(drafts).length > 0;
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  useEffect(() => () => onDirty(false), [onDirty]);

  // Live preview of the new list prices (server-side pricing — the same code that saves).
  // Debounce a string: a fresh array every render would restart the timer forever.
  const previewKey = useDebounced(items.length && items.length <= MAX_BATCH && !invalid ? JSON.stringify(items) : "", 400);
  const previewItems = previewKey ? JSON.parse(previewKey) : null;
  const preview = useQuery({
    queryKey: ["price-preview", project.id, previewKey],
    queryFn: async () => (await apiRequest(`/projects/${project.id}/units/prices`, { method: "POST", body: { dryRun: true, items: previewItems } })).data,
    enabled: Boolean(previewItems) && canEdit,
    staleTime: 30_000,
    retry: false,
  });
  const previewById = new Map((preview.data ?? []).map((r) => [r.id, r]));

  if (units.isPending) return <Skeleton className="h-96 w-full" />;
  if (units.isError) return <ErrorState title={t("loadFailed")} description={errorMessage(te, units.error)} />;
  if (!list.length) {
    return (
      <EmptyState
        icon={Rows3}
        title={t("noUnits")}
        action={
          <Button as={Link} href={`/dashboard/projects/${project.id}`} size="sm" variant="secondary">
            {t("toInventory")}
          </Button>
        }
      />
    );
  }

  const rows = list
    .filter((u) => (show === "changed" ? changedIds.has(u.id) : show === "custom" ? u.rateOverride != null || u.priceAdjustment || changedIds.has(u.id) : true))
    .sort((a, b) => (plot ? a.code.localeCompare(b.code, "en", { numeric: true }) : 0)); // apartments: API order (top floor first)
  const selectable = rows.filter((u) => !isSold(u));
  const allSelected = selectable.length > 0 && selectable.every((u) => selected.has(u.id));

  const setDraft = (u, patch) => setDrafts((m) => ({ ...m, [u.id]: { ...(m[u.id] ?? empty(u)), ...patch } }));
  const toggle = (u, shift) => {
    const next = new Set(selected);
    if (shift && anchor) {
      const ids = rows.map((r) => r.id);
      const [a, b] = [ids.indexOf(anchor), ids.indexOf(u.id)].sort((x, y) => x - y);
      for (const r of rows.slice(a, b + 1)) if (!isSold(r)) next.add(r.id);
    } else if (next.has(u.id)) next.delete(u.id);
    else next.add(u.id);
    setSelected(next);
    setAnchor(u.id);
  };

  const applyBulk = () => {
    const targets = list.filter((u) => selected.has(u.id) && !isSold(u));
    const v = bulk.value.trim();
    const next = { ...drafts };
    for (const u of targets) {
      const d = next[u.id] ?? empty(u);
      if (bulk.mode === "rate") next[u.id] = { ...d, rate: v };
      else if (bulk.mode === "pct") {
        const base = takaToPoisha(d.rate) ?? u.rateOverride ?? cardRate;
        const pct = Number(v);
        if (base == null || !Number.isFinite(pct)) continue;
        next[u.id] = { ...d, rate: poishaToTaka(Math.max(0, Math.round((base * (1 + pct / 100)) / 100) * 100)) };
      } else if (bulk.mode === "adj") next[u.id] = { ...d, adj: v, note: bulk.note };
      else next[u.id] = { rate: "", adj: "", note: "" };
    }
    setDrafts(next);
    toast(t("applied", { n: formatNumber(targets.length, locale) }));
  };
  const bulkValid =
    bulk.mode === "clear" ||
    (bulk.mode === "pct" ? /^-?\d+(\.\d+)?$/.test(bulk.value.trim()) && Number(bulk.value) > -100 && Number(bulk.value) <= 500 : bulk.value.trim() === "" ? bulk.mode === "rate" : takaToPoisha(bulk.value) !== null && (bulk.mode === "adj" || takaToPoisha(bulk.value) >= 0));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiRequest(`/projects/${project.id}/units/prices`, { method: "POST", body: { items } });
      const fresh = new Map(res.data.map((u) => [u.id, u]));
      qc.setQueriesData({ queryKey: ["project-units", project.id] }, (l) => (Array.isArray(l) ? l.map((u) => (fresh.has(u.id) ? { ...u, ...fresh.get(u.id) } : u)) : l));
      qc.invalidateQueries({ queryKey: ["unit"] });
      qc.invalidateQueries({ queryKey: keys.project(project.id) });
      qc.invalidateQueries({ queryKey: ["floorplan"] });
      setDrafts((m) => Object.fromEntries(Object.entries(m).filter(([id]) => !fresh.has(id))));
      toast.success(t("saved", { n: res.meta?.changed ?? res.data.length, count: formatNumber(res.meta?.changed ?? res.data.length, locale) }));
    } catch (err) {
      if (err?.code === "STALE_VERSION") {
        const codes = (err.details ?? []).map((d) => d.message).filter(Boolean);
        setError({ stale: true, message: codes.length ? t("staleCodes", { codes: codes.join(", ") }) : t("stale") });
      } else if (err?.code === "UNIT_LOCKED") setError({ message: t("locked") });
      else setError({ message: errorMessage(te, err) });
    } finally {
      setSaving(false);
    }
  };

  const reloadStale = async () => {
    const before = new Map(list.map((u) => [u.id, u.version]));
    const { data } = await units.refetch();
    const moved = new Set((data ?? []).filter((u) => before.get(u.id) !== u.version).map((u) => u.id));
    setDrafts((m) => Object.fromEntries(Object.entries(m).filter(([id]) => !moved.has(id))));
    setError(null);
  };

  const where = (u) =>
    plot ? (
      <>
        <span>{u.plotNo ?? "—"}</span>
        {u.road && <span className="text-ink-subtle"> · {u.road}</span>}
      </>
    ) : (
      <>
        {ti("floor")} {floorLabel(u.floor, locale, ti)} · {u.position ?? "—"}
      </>
    );
  const size = (u) => (plot ? formatAreaValue(u.landArea?.[rateUnit], rateUnit, locale) : formatAreaValue(u.saleableSqft, "sqft", locale, 2));

  return (
    <div className="space-y-4">
      <FormAlert>
        {error && (
          <span className="flex flex-wrap items-center justify-between gap-3">
            {error.message}
            {error.stale && (
              <Button size="sm" variant="secondary" onClick={reloadStale}>
                {t("reloadStale")}
              </Button>
            )}
          </span>
        )}
      </FormAlert>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-ink-muted">
          {cardRate == null ? t("noCard") : t("cardRate", { rate: formatBDT(cardRate, locale), unit: unitLabel })}{" "}
          <Link href={`/dashboard/projects/${project.id}/pricing`} className="text-accent underline-offset-4 hover:underline">
            {t("editCard")}
          </Link>
        </p>
        <Segmented
          name="pm-show"
          size="sm"
          aria-label={t("show")}
          value={show}
          onChange={setShow}
          options={[
            { value: "all", label: t("showAll", { n: formatNumber(list.length, locale) }) },
            { value: "custom", label: t("showCustom") },
            { value: "changed", label: t("showChanged", { n: formatNumber(items.length, locale) }) },
          ]}
        />
      </div>

      {canEdit && selected.size > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-accent-soft/40 px-4 py-3 xl:flex-row xl:items-end">
          <p className="text-sm font-medium xl:mb-2">{t("selected", { n: selected.size, count: formatNumber(selected.size, locale) })}</p>
          <Field label={t("bulk.action")}>
            <Segmented
              name="pm-bulk"
              size="sm"
              aria-label={t("bulk.action")}
              value={bulk.mode}
              onChange={(mode) => setBulk({ mode, value: "", note: "" })}
              className="self-start"
              options={["rate", "pct", "adj", "clear"].map((m) => ({ value: m, label: t(`bulk.${m}`) }))}
            />
          </Field>
          {bulk.mode !== "clear" && (
            <Field label={bulk.mode === "pct" ? t("bulk.pctLabel") : bulk.mode === "rate" ? t("bulk.rateLabel", { unit: unitLabel }) : t("bulk.adjLabel")} className="xl:w-44">
              <Input
                inputMode="decimal"
                value={bulk.value}
                onChange={(e) => setBulk({ ...bulk, value: e.target.value })}
                leading={bulk.mode !== "pct" ? <span className="text-xs">৳</span> : undefined}
                trailing={bulk.mode === "pct" ? <span className="pr-1 text-xs text-ink-subtle">%</span> : undefined}
                placeholder={bulk.mode === "pct" ? "5" : bulk.mode === "adj" ? "-50000" : ""}
              />
            </Field>
          )}
          {bulk.mode === "adj" && (
            <Field label={t("note")} className="xl:w-56">
              <Input value={bulk.note} maxLength={200} onChange={(e) => setBulk({ ...bulk, note: e.target.value })} placeholder={t("notePlaceholder")} />
            </Field>
          )}
          <div className="flex gap-2">
            <Button size="sm" disabled={!bulkValid} onClick={applyBulk}>
              {t("bulk.apply")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              {t("bulk.deselect")}
            </Button>
          </div>
          <p className="text-xs text-ink-muted xl:mb-2 xl:ml-auto xl:max-w-56">{t(`bulk.${bulk.mode}Hint`)}</p>
        </div>
      )}

      <Table>
        <THead>
          <tr>
            {canEdit && (
              <TH className="w-10 pr-0">
                <input
                  type="checkbox"
                  aria-label={t("selectAll")}
                  className="size-4 accent-primary"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((u) => u.id)))}
                />
              </TH>
            )}
            <TH>{t("col.unit")}</TH>
            <TH align="right">{t(plot ? "col.land" : "col.size")}</TH>
            <TH>{t("col.status")}</TH>
            <TH>{t("col.rate", { unit: unitLabel })}</TH>
            <TH>{t("col.adjustment")}</TH>
            <TH align="right">{t("col.now")}</TH>
            <TH align="right">{t("col.new")}</TH>
          </tr>
        </THead>
        <TBody>
          {rows.map((u) => {
            const sold = isSold(u);
            const d = draftOf(u);
            const p = parse(d);
            const changed = changedIds.has(u.id);
            const pv = previewById.get(u.id);
            const diff = pv && pv.previousListPrice != null && pv.listPrice != null ? pv.listPrice - pv.previousListPrice : null;
            const ro = !canEdit || sold;
            return (
              <TR key={u.id} className={cn(changed && "bg-accent-soft/30 hover:bg-accent-soft/40", selected.has(u.id) && "bg-accent-soft/50")}>
                {canEdit && (
                  <TD className="pr-0">
                    {sold ? (
                      <Lock aria-label={t("soldLocked")} className="size-3.5 text-ink-subtle" />
                    ) : (
                      <input
                        type="checkbox"
                        aria-label={t("selectUnit", { code: u.code })}
                        className="size-4 accent-primary"
                        checked={selected.has(u.id)}
                        onChange={() => {}}
                        onClick={(e) => toggle(u, e.shiftKey)}
                      />
                    )}
                  </TD>
                )}
                <TD className="whitespace-nowrap">
                  <p className="font-mono text-[13px] font-medium">{u.code}</p>
                  <p className="text-[11px] text-ink-muted">{where(u)}</p>
                </TD>
                <TD numeric className="whitespace-nowrap text-ink-muted">
                  {size(u)}
                </TD>
                <TD>
                  <StatusChip status={u.status} size="sm" />
                </TD>
                <TD className="min-w-36">
                  {ro ? (
                    <span className="font-mono text-[13px]">{u.rateOverride != null ? formatBDT(u.rateOverride, locale) : <span className="text-ink-subtle">{t("cardShort")}</span>}</span>
                  ) : (
                    <Input
                      inputMode="decimal"
                      aria-label={t("col.rate", { unit: unitLabel })}
                      aria-invalid={!p.rateOk || undefined}
                      value={d.rate}
                      onChange={(e) => setDraft(u, { rate: e.target.value })}
                      placeholder={cardRate != null ? poishaToTaka(cardRate) : ""}
                      leading={<span className="text-xs">৳</span>}
                      className="h-8! font-mono text-[13px]!"
                    />
                  )}
                </TD>
                <TD className="min-w-56">
                  {ro ? (
                    <span className="font-mono text-[13px]">
                      {u.priceAdjustment ? formatBDT(u.priceAdjustment.amount, locale) : "—"}
                      {u.priceAdjustment?.note && <span className="ml-2 font-sans text-[11px] text-ink-muted">{u.priceAdjustment.note}</span>}
                    </span>
                  ) : (
                    <div className="flex gap-1.5">
                      <Input
                        inputMode="decimal"
                        aria-label={t("col.adjustment")}
                        aria-invalid={!p.adjOk || undefined}
                        value={d.adj}
                        onChange={(e) => setDraft(u, { adj: e.target.value })}
                        leading={<span className="text-xs">৳</span>}
                        className="h-8! w-32 font-mono text-[13px]!"
                      />
                      <Input aria-label={t("note")} value={d.note} maxLength={200} disabled={!d.adj.trim()} onChange={(e) => setDraft(u, { note: e.target.value })} placeholder={t("note")} className="h-8! w-28 text-xs!" />
                    </div>
                  )}
                </TD>
                <TD numeric className="whitespace-nowrap">
                  {u.listPrice != null ? formatBDT(u.listPrice, locale) : <span className="text-ink-subtle">{t("onRequest")}</span>}
                </TD>
                <TD numeric className="whitespace-nowrap">
                  {changed ? (
                    pv ? (
                      <>
                        <span className="font-semibold">{pv.listPrice != null ? formatBDT(pv.listPrice, locale) : "—"}</span>
                        {diff != null && diff !== 0 && <span className={cn("block text-[11px]", diff < 0 ? "text-danger" : "text-success")}>{`${diff > 0 ? "+" : "−"}${formatBDT(Math.abs(diff), locale)}`}</span>}
                      </>
                    ) : (
                      <span className="text-ink-subtle">{preview.isError ? "!" : "…"}</span>
                    )
                  ) : (
                    <span className="text-ink-subtle">—</span>
                  )}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      {canEdit && (
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur-sm sm:-mx-8 sm:px-8">
          <span className="mr-auto text-xs text-ink-muted">
            {items.length ? t("pending", { n: items.length, count: formatNumber(items.length, locale) }) : t("noChanges")}
            {invalid > 0 && <span className="ml-3 text-danger">{t("invalid", { n: invalid, count: formatNumber(invalid, locale) })}</span>}
            {items.length > MAX_BATCH && <span className="ml-3 text-danger">{t("tooMany", { n: formatNumber(MAX_BATCH, locale) })}</span>}
            {preview.isError && <span className="ml-3 text-danger">{t("previewFailed")}</span>}
          </span>
          <Button variant="ghost" disabled={!Object.keys(drafts).length || saving} onClick={() => setDrafts({})}>
            {t("discard")}
          </Button>
          <Button loading={saving} disabled={!items.length || invalid > 0 || items.length > MAX_BATCH} onClick={save}>
            {t("save", { n: items.length, count: formatNumber(items.length, locale) })}
          </Button>
        </div>
      )}
      {!canEdit && <p className="text-xs text-ink-muted">{t("readOnly")}</p>}
    </div>
  );
}

/** Price list tab: one building/sector at a time. */
export function PriceMatrix() {
  const { id } = useParams();
  const t = useTranslations("priceMatrix");
  const locale = useLocale();
  const { data: project } = useProject(id);
  const [picked, setPicked] = useState(null);
  const [dirty, setDirty] = useState(false);
  if (!project) return <Skeleton className="h-96 w-full" />;
  const blocks = project.blocks ?? [];
  const block = blocks.find((b) => b.id === picked) ?? blocks[0];
  if (!block) return <EmptyState icon={Tags} title={t("noBlocks")} />;

  return (
    <div>
      <p className="mb-5 max-w-3xl text-sm leading-relaxed text-ink-muted">{t(project.kind === "plot" ? "introPlot" : "intro")}</p>
      {blocks.length > 1 && (
        <div role="tablist" aria-label={t("blocks")} className="mb-5 flex flex-wrap gap-1.5">
          {blocks.map((b) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={b.id === block.id}
              disabled={dirty && b.id !== block.id}
              title={dirty && b.id !== block.id ? t("saveFirst") : undefined}
              onClick={() => setPicked(b.id)}
              className={cn(
                "flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition-colors",
                b.id === block.id ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <span className="font-mono text-xs">{b.code}</span>
              <span className="max-w-40 truncate">{locale === "bn" && b.nameBn ? b.nameBn : b.name}</span>
            </button>
          ))}
        </div>
      )}
      {/* Drafts belong to one building: other tabs are locked until they are saved or discarded. */}
      <Matrix key={`${block.id}:${project.version}`} project={project} block={block} onDirty={setDirty} />
    </div>
  );
}
