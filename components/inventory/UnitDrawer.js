"use client";

import { useState } from "react";
import { Clock, FileSignature, FileText, Lock, Pencil, ShieldOff, Trash2, Unlock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { StatusChip } from "@/components/ui/StatusChip";
import { Table, TBody, TD, TR } from "@/components/ui/Table";
import { toast } from "@/components/ui/Toast";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/client";
import { errorMessage, useSession } from "@/lib/auth/session";
import { formatBDT, formatDate, formatLand, formatNumber, formatSqftArea, areaUnitLabel } from "@/lib/format";
import { BLOCK_REASONS, SOLD_STATUSES } from "@/lib/unitStatus";
import { floorLabel } from "./ElevationGrid";
import { useUnit, useUnitCache } from "./queries";
import { UnitForm } from "./UnitForm";

const HOLD_HOURS = [2, 6, 12, 24, 48, 72];
const FORM_ID = "unit-form";

function useRelative() {
  const locale = useLocale();
  const rtf = new Intl.RelativeTimeFormat(locale === "bn" ? "bn-BD" : "en", { numeric: "auto" });
  return (iso) => {
    const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
    if (Math.abs(mins) < 60) return rtf.format(mins, "minute");
    const hours = Math.round(mins / 60);
    return Math.abs(hours) < 48 ? rtf.format(hours, "hour") : rtf.format(Math.round(hours / 24), "day");
  };
}

function Detail({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="text-right text-sm">{children ?? "—"}</dd>
    </div>
  );
}

/** Itemised price — the same lines a booking will freeze (API.md › PriceBreakdown). */
function PriceBreakdown({ price }) {
  const t = useTranslations("inventory.price");
  const locale = useLocale();
  if (!price) return <p className="rounded-md border border-dashed border-line-strong/60 px-4 py-5 text-center text-sm text-ink-muted">{t("onRequest")}</p>;
  const lineLabel = (l) => {
    if (l.code.startsWith("charge:")) return (locale === "bn" && l.labelBn) || l.label;
    return t(`lines.${l.code}`);
  };
  const basis = (l) => {
    if (l.qty == null || l.rate == null) return l.bps ? t("bps", { pct: formatNumber(l.bps / 100, locale) }) : l.note ?? "";
    const unit = l.qtyUnit === "slot" ? t("slots") : areaUnitLabel(l.qtyUnit, locale);
    return `${formatNumber(l.qty, locale, { maximumFractionDigits: 4 })} ${unit} × ${formatBDT(l.rate, locale)}`;
  };
  return (
    <Table>
      <TBody>
        {price.lines.map((l) => (
          <TR key={l.code}>
            <TD className="py-2">
              <p className="text-sm">{lineLabel(l)}</p>
              <p className="text-[11px] text-ink-subtle">{basis(l)}</p>
            </TD>
            <TD numeric className={l.amount < 0 ? "text-danger" : undefined}>
              {formatBDT(l.amount, locale)}
            </TD>
          </TR>
        ))}
        <TR className="bg-surface-2 hover:bg-surface-2">
          <TD className="text-xs font-semibold tracking-wide uppercase">{t("total")}</TD>
          <TD numeric className="text-base font-semibold">
            {formatBDT(price.total, locale)}
          </TD>
        </TR>
      </TBody>
    </Table>
  );
}

function StatusPanel({ unit, onChanged }) {
  const t = useTranslations("inventory.actions");
  const tr = useTranslations("inventory.blockReasons");
  const ti = useTranslations("inventory");
  const te = useTranslations("errors");
  const locale = useLocale();
  const relative = useRelative();
  const { can, user } = useSession();
  const [mode, setMode] = useState(null); // 'hold' | 'block' | 'extend'
  const [hours, setHours] = useState("24");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("landowner_share");
  const [busy, setBusy] = useState(false);

  const run = async (path, body, okMsg) => {
    setBusy(true);
    try {
      const u = await api.post(`/units/${unit.id}/${path}`, body);
      toast.success(okMsg);
      setMode(null);
      setNote("");
      onChanged(u);
    } catch (err) {
      const code = err?.code;
      if (["UNIT_STATE_CONFLICT", "HOLD_LIMIT", "NOT_HOLDER"].includes(code)) toast.error(ti(`errors.${code}`, { limit: err.details?.limit ?? "" }));
      else toast.error(errorMessage(te, err));
      if (code === "UNIT_STATE_CONFLICT") onChanged(null); // refetch the real state
    } finally {
      setBusy(false);
    }
  };

  const s = unit.status;
  const isHolder = unit.hold?.by && unit.hold.by === user?.id;
  const hourOptions = HOLD_HOURS.map((h) => (
    <option key={h} value={h}>
      {t("hours", { n: h })}
    </option>
  ));

  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusChip status={s} />
        {s === "held" && unit.hold && (
          <p className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Clock aria-hidden className="size-3.5" />
            {t("heldBy", { name: unit.hold.byName ?? "—", when: relative(unit.hold.until) })}
          </p>
        )}
      </div>
      {s === "held" && unit.hold?.note && <p className="mt-2 text-sm text-ink-muted">“{unit.hold.note}”</p>}
      {s === "held" && unit.hold && <p className="mt-1 font-mono text-[11px] text-ink-subtle">{t("until", { at: formatDate(unit.hold.until, locale, "datetime") })}</p>}
      {s === "blocked" && (
        <p className="mt-2 text-sm text-ink-muted">
          {tr(unit.blockReason ?? "other")}
          {unit.blockNote && ` — ${unit.blockNote}`}
        </p>
      )}
      {SOLD_STATUSES.includes(s) && <p className="mt-2 text-xs text-ink-muted">{t("soldInfo")}</p>}

      {mode === null && (
        <div className="mt-4 flex flex-wrap gap-2">
          {can("bookings:create") && (s === "available" || (s === "held" && (isHolder || can("units:write")))) && (
            <Button as={Link} href={`/dashboard/bookings/new?unitId=${unit.id}&projectId=${unit.projectId}`} size="sm" variant="accent">
              <FileSignature aria-hidden className="size-3.5" />
              {t("book")}
            </Button>
          )}
          {SOLD_STATUSES.includes(s) && can("bookings:read", "bookings:read_all") && (
            <Button as={Link} href={`/dashboard/bookings?q=${encodeURIComponent(unit.code)}&projectId=${unit.projectId}`} size="sm" variant="secondary">
              <FileText aria-hidden className="size-3.5" />
              {t("openBooking")}
            </Button>
          )}
          {s === "available" && can("units:hold") && (
            <Button size="sm" onClick={() => setMode("hold")}>
              <Lock aria-hidden className="size-3.5" />
              {t("hold")}
            </Button>
          )}
          {s === "available" && can("units:block") && (
            <Button size="sm" variant="secondary" onClick={() => setMode("block")}>
              <ShieldOff aria-hidden className="size-3.5" />
              {t("block")}
            </Button>
          )}
          {s === "held" && (isHolder || can("units:write")) && (
            <Button size="sm" variant="secondary" loading={busy} onClick={() => run("release", undefined, t("released"))}>
              <Unlock aria-hidden className="size-3.5" />
              {t("release")}
            </Button>
          )}
          {s === "held" && can("units:write") && (
            <Button size="sm" variant="ghost" onClick={() => setMode("extend")}>
              <Clock aria-hidden className="size-3.5" />
              {t("extend")}
            </Button>
          )}
          {s === "blocked" && can("units:block") && (
            <Button size="sm" variant="secondary" loading={busy} onClick={() => run("unblock", undefined, t("unblocked"))}>
              <Unlock aria-hidden className="size-3.5" />
              {t("unblock")}
            </Button>
          )}
        </div>
      )}

      {mode === "hold" && (
        <form
          className="mt-4 space-y-3 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            run("hold", { hours: Number(hours), ...(note.trim() && { note: note.trim() }) }, t("heldOk"));
          }}
        >
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <Field label={t("duration")}>
              <Select value={hours} onChange={(e) => setHours(e.target.value)}>
                {hourOptions}
              </Select>
            </Field>
            <Field label={t("note")} hint={t("noteHint")}>
              <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
              {t("cancel")}
            </Button>
            <Button size="sm" type="submit" loading={busy}>
              {t("confirmHold")}
            </Button>
          </div>
        </form>
      )}

      {mode === "extend" && (
        <form
          className="mt-4 flex items-end gap-3 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            run("hold/extend", { hours: Number(hours) }, t("extended"));
          }}
        >
          <Field label={t("newExpiry")} className="flex-1">
            <Select value={hours} onChange={(e) => setHours(e.target.value)}>
              {hourOptions}
            </Select>
          </Field>
          <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
            {t("cancel")}
          </Button>
          <Button size="sm" type="submit" loading={busy}>
            {t("extend")}
          </Button>
        </form>
      )}

      {mode === "block" && (
        <form
          className="mt-4 space-y-3 border-t border-line pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason === "other" && note.trim().length < 3) return toast.error(t("noteRequired"));
            run("block", { reason, ...(note.trim() && { note: note.trim() }) }, t("blockedOk"));
          }}
        >
          <Field label={t("reason")}>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              {BLOCK_REASONS.map((r) => (
                <option key={r} value={r}>
                  {tr(r)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("note")} hint={t("blockNoteHint")}>
            <Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} required={reason === "other"} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
              {t("cancel")}
            </Button>
            <Button size="sm" type="submit" loading={busy}>
              {t("confirmBlock")}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function UnitDetails({ unit, block }) {
  const t = useTranslations("inventory.form");
  const tf = useTranslations("inventory.facing");
  const ti = useTranslations("inventory");
  const locale = useLocale();
  const yes = (b) => (b ? ti("yes") : ti("no"));
  return (
    <dl className="divide-y divide-line">
      <Detail label={unit.kind === "plot" ? t("sector") : t("building")}>{block ? `${block.code} · ${block.name}` : "—"}</Detail>
      {unit.kind === "apartment" ? (
        <>
          <Detail label={t("floor")}>{unit.floor != null ? floorLabel(unit.floor, locale, ti) : "—"}</Detail>
          <Detail label={t("position")}>{unit.position}</Detail>
          <Detail label={t("typeLabel")}>{unit.typeLabel}</Detail>
          <Detail label={ti("rooms")}>
            {ti("roomsValue", { bed: unit.bedrooms ?? "—", bath: unit.bathrooms ?? "—", balc: unit.balconies ?? "—" })}
          </Detail>
          <Detail label={t("saleableSqft")}>{unit.saleableSqft != null ? formatSqftArea(unit.saleableSqft, unit.saleableSqm, locale) : null}</Detail>
          <Detail label={t("carpetSqft")}>{unit.carpetSqft != null ? formatSqftArea(unit.carpetSqft, unit.carpetSqm, locale) : null}</Detail>
          <Detail label={t("parkingSlots")}>{formatNumber(unit.parkingSlots ?? 0, locale)}</Detail>
        </>
      ) : (
        <>
          <Detail label={t("plotNo")}>{unit.plotNo}</Detail>
          <Detail label={t("road")}>
            {[unit.road, unit.roadWidthFt != null && ti("roadWidth", { ft: formatNumber(unit.roadWidthFt, locale) })].filter(Boolean).join(" · ") || null}
          </Detail>
          <Detail label={t("landArea")}>{unit.landArea ? formatLand(unit.landArea, locale) : null}</Detail>
          <Detail label={ti("inSqft")}>{unit.landArea ? formatSqftArea(unit.landArea.sqft, unit.landArea.sqm, locale) : null}</Detail>
          {unit.dimensions && (
            <Detail label={t("dimensions")}>
              {["frontFt", "backFt", "leftFt", "rightFt"].map((k) => formatNumber(unit.dimensions[k] ?? "—", locale)).join(" × ")} {t("ft")}
            </Detail>
          )}
        </>
      )}
      <Detail label={t("facing")}>{unit.facing ? tf(unit.facing) : null}</Detail>
      <Detail label={ti("corner")}>{yes(unit.isCorner)}</Detail>
    </dl>
  );
}

/**
 * One unit: live status + actions, details, itemised price, edit, delete.
 * `state` = null | { unitId } | { create: { blockId, floor?, position? } }.
 */
export function UnitDrawer({ state, project, blocks, onClose }) {
  const t = useTranslations("inventory");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const { can } = useSession();
  const unitId = state?.unitId;
  const creating = Boolean(state?.create);
  const q = useUnit(unitId);
  const cache = useUnitCache();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const unit = q.data;
  const block = blocks.find((b) => b.id === (unit?.blockId ?? state?.create?.blockId));

  const close = () => {
    setEditing(false);
    setConfirmDelete(false);
    onClose();
  };

  const onChanged = (u) => {
    if (u) cache(u);
    q.refetch();
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/units/${unit.id}`);
      toast.success(t("deleted", { code: unit.code }));
      qc.invalidateQueries({ queryKey: ["project-units", project.id] });
      qc.invalidateQueries({ queryKey: ["project", project.id] });
      close();
    } catch (err) {
      toast.error(err?.code === "UNIT_IN_USE" ? t("errors.UNIT_IN_USE") : errorMessage(te, err));
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  const formOpen = creating || editing;
  const title = creating ? t("newUnit") : (unit?.code ?? "…");

  return (
    <Drawer
      open={Boolean(state)}
      onClose={close}
      width="md"
      title={title}
      description={block ? `${project.name} · ${block.code}` : project.name}
      footer={
        formOpen ? (
          <>
            {/* Distinct keys: React must not reuse the clicked "Edit" <button> as this submit
                button, or the browser's default action would submit the form right away. */}
            <Button key="cancel" variant="ghost" onClick={creating ? close : () => setEditing(false)}>
              {tc("cancel")}
            </Button>
            <Button key="submit" type="submit" form={FORM_ID} loading={busy}>
              {creating ? t("createUnit") : tc("save")}
            </Button>
          </>
        ) : (
          unit &&
          can("units:write") && (
            <>
              {["available", "blocked"].includes(unit.status) &&
                (confirmDelete ? (
                  <span className="mr-auto flex items-center gap-2">
                    <span className="text-xs text-danger">{t("confirmDelete")}</span>
                    <Button size="sm" variant="danger" loading={busy} onClick={remove}>
                      {t("delete")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                      {tc("cancel")}
                    </Button>
                  </span>
                ) : (
                  <Button variant="ghost" className="mr-auto text-danger" onClick={() => setConfirmDelete(true)} aria-label={t("delete")}>
                    <Trash2 aria-hidden className="size-4" />
                  </Button>
                ))}
              <Button key="edit" variant="secondary" onClick={() => setEditing(true)}>
                <Pencil aria-hidden className="size-4" />
                {t("edit")}
              </Button>
            </>
          )
        )
      }
    >
      {creating ? (
        <UnitForm
          formId={FORM_ID}
          project={project}
          blocks={blocks}
          preset={state.create}
          onBusy={setBusy}
          onSaved={(u) => {
            toast.success(t("created", { code: u.code }));
            cache(u);
            close();
          }}
        />
      ) : q.isError ? (
        <ErrorState title={t("unitLoadFailed")} description={errorMessage(te, q.error)} requestId={q.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : !unit ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : editing ? (
        <UnitForm
          key={unit.version}
          formId={FORM_ID}
          project={project}
          blocks={blocks}
          unit={unit}
          onBusy={setBusy}
          onSaved={(u) => {
            toast.success(t("saved"));
            onChanged(u);
            setEditing(false);
          }}
        />
      ) : (
        <div className="space-y-6">
          <StatusPanel unit={unit} onChanged={onChanged} />
          <section>
            <h3 className="mb-1 text-xs font-semibold tracking-[0.12em] text-ink-muted uppercase">{t("details")}</h3>
            <UnitDetails unit={unit} block={block} />
          </section>
          <section>
            <h3 className="mb-3 text-xs font-semibold tracking-[0.12em] text-ink-muted uppercase">{t("priceTitle")}</h3>
            <PriceBreakdown price={unit.price} />
          </section>
        </div>
      )}
    </Drawer>
  );
}
