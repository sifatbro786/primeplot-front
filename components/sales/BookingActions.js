"use client";

import { useState } from "react";
import { Check, ChevronDown, Undo2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { toast } from "@/components/ui/Toast";
import { useRouter } from "@/i18n/navigation";
import { apiRequest } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { useSalesError } from "@/lib/sales/errors";
import { useSalesRefresh } from "@/lib/sales/queries";
import { CancelDrawer, RefundDrawer } from "./actions/CancelRefund";
import { CallDialog, ChargeDrawer, ChequeReceiveDrawer, StageDialog, WaiveDialog } from "./actions/SimpleActions";
import { RescheduleDrawer, TransferDrawer } from "./actions/TransferReschedule";
import { useDay, useMoney } from "./parts";

const NEXT_STAGE = { booked: "allot", allotted: "register", registered: "handover" };

/** The "Actions" menu on a booking + every dialog it opens (B4.2 lifecycle). */
export function BookingActionsMenu({ b }) {
  const t = useTranslations("sales.actions");
  const locale = useLocale();
  const router = useRouter();
  const salesError = useSalesError();
  const refresh = useSalesRefresh();
  const { can } = useSession();
  const [open, setOpen] = useState(null);
  const active = b.status === "active";
  const stage = b.stage ?? "booked";
  const early = ["booked", "allotted"].includes(stage);
  const next = NEXT_STAGE[stage];

  const statement = async () => {
    try {
      const { data } = await apiRequest(`/bookings/${b.id}/statement`, { method: "POST" });
      refresh({ bookingId: b.id });
      router.push(`/dashboard/documents/${data.id}`);
    } catch (err) {
      toast.error(salesError(err, locale));
    }
  };

  const items = [];
  if (active && next && can("bookings:override")) items.push({ key: next, label: t(`${next}.menu`) });
  if (active && can("cheques:manage")) items.push({ key: "cheque", label: t("cheque.menu") });
  if (active && can("bookings:override")) {
    items.push({ key: "charge", label: t("charge.menu") });
    items.push({ key: "reschedule", label: t("reschedule.menu") });
    if (early) items.push({ key: "transfer", label: t("transfer.menu") });
  }
  if (can("documents:issue")) items.push({ key: "statement", label: t("statementMenu"), onSelect: statement });
  if (active && early && can("bookings:cancel")) items.push({ key: "cancel", label: t("cancel.menu"), danger: true });

  const refundDue = b.cancellation?.refundDue ?? 0;
  const close = () => setOpen(null);

  return (
    <>
      {b.status === "cancelled" && refundDue > 0 && can("bookings:cancel") && (
        <Button variant="secondary" onClick={() => setOpen("refund")}>
          <Undo2 aria-hidden className="size-4" />
          {t("refund.menu")}
        </Button>
      )}
      {items.length > 0 && (
        <Menu
          label={t("label")}
          width="w-60"
          trigger={(p) => (
            <Button variant="secondary" {...p}>
              {t("label")}
              <ChevronDown aria-hidden className="size-4" />
            </Button>
          )}
          items={items.map((i) => ({ ...i, onSelect: i.onSelect ?? (() => setOpen(i.key)) }))}
        />
      )}
      {["allot", "register", "handover"].includes(open) && <StageDialog kind={open} booking={b} onClose={close} />}
      {open === "cheque" && <ChequeReceiveDrawer booking={b} onClose={close} />}
      {open === "charge" && <ChargeDrawer booking={b} onClose={close} />}
      {open === "reschedule" && <RescheduleDrawer booking={b} onClose={close} />}
      {open === "transfer" && <TransferDrawer booking={b} onClose={close} />}
      {open === "cancel" && <CancelDrawer booking={b} onClose={close} />}
      {open === "refund" && <RefundDrawer booking={b} onClose={close} />}
    </>
  );
}

/** Row actions in the schedule: call an undated item, waive an unpaid charge. */
export function useScheduleActions(b) {
  const t = useTranslations("sales.actions");
  const { can } = useSession();
  const [open, setOpen] = useState(null);
  const enabled = b.status === "active" && can("bookings:override");
  const render = enabled
    ? (i) => {
        const unpaid = (i.amount ?? 0) > (i.paid ?? 0);
        if (!unpaid) return null;
        if (i.code === "charge" && !i.paid) {
          return (
            <Button size="sm" variant="ghost" className="text-danger" onClick={() => setOpen({ kind: "waive", item: i })}>
              {t("waive.menu")}
            </Button>
          );
        }
        if (i.status === "not_called") {
          return (
            <Button size="sm" variant="ghost" onClick={() => setOpen({ kind: "call", item: i })}>
              {t("call.menu")}
            </Button>
          );
        }
        return null;
      }
    : undefined;
  const dialogs = (
    <>
      {open?.kind === "call" && <CallDialog item={open.item} booking={b} onClose={() => setOpen(null)} />}
      {open?.kind === "waive" && <WaiveDialog item={open.item} booking={b} onClose={() => setOpen(null)} />}
    </>
  );
  return { render, dialogs };
}

/** booked → allotted → registered → handed over, with the date each step happened. */
export function StageTimeline({ b }) {
  const t = useTranslations("sales.stage");
  const ta = useTranslations("sales.actions");
  const day = useDay();
  const steps = [
    ["booked", { date: b.bookingDate }],
    ["allotted", b.allotment],
    ["registered", b.registration],
    ["handed_over", b.handover],
  ];
  if (b.status === "cancelled") return null;
  return (
    <ol className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={ta("timeline")}>
      {steps.map(([k, ev]) => (
        <li key={k} className={cn("rounded-md border px-3 py-2.5", ev ? "border-success/30 bg-success-bg/40" : "border-dashed border-line-strong/70")}>
          <p className="flex items-center gap-1.5 text-xs font-medium">
            {ev ? <Check aria-hidden className="size-3.5 text-success" /> : <span aria-hidden className="size-3.5 rounded-full border border-line-strong" />}
            {t(k)}
          </p>
          <p className="mt-1 text-[11px] text-ink-muted">
            {ev?.date ? day(ev.date) : "—"}
            {k === "registered" && ev?.deedNo ? ` · ${ta("deed", { no: ev.deedNo })}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Cancelled booking: the settlement and what is still to be refunded. */
export function CancellationPanel({ b }) {
  const t = useTranslations("sales.actions.cancel");
  const money = useMoney();
  const day = useDay();
  const c = b.cancellation;
  if (!c) return null;
  return (
    <section className="mb-8 rounded-lg border border-danger/30 bg-danger-bg/40 p-5">
      <h3 className="text-sm font-semibold">{t("panelTitle", { date: day(c.date) })}</h3>
      <p className="mt-1 text-sm text-ink-muted">
        {c.reason}
        {c.by?.name ? ` — ${c.by.name}` : ""}
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          ["paid", c.paid],
          ["deduction", c.deduction],
          ["refundable", c.refundable],
          ["refunded", c.refunded],
          ["refundDue", c.refundDue],
        ].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[11px] tracking-wide text-ink-subtle uppercase">{t(`panel.${k}`)}</dt>
            <dd className={cn("mt-1 font-mono text-sm tabular-nums", k === "refundDue" && v > 0 && "text-danger")}>{money(v ?? 0)}</dd>
          </div>
        ))}
      </dl>
      {c.overrideReason && <p className="mt-3 text-xs text-ink-muted">{t("overrideNote", { reason: c.overrideReason })}</p>}
    </section>
  );
}
