"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowLeft, Check, RotateCcw } from "lucide-react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useAllUnits, useLiveInventory } from "@/components/inventory/queries";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/States";
import { Link, useRouter } from "@/i18n/navigation";
import { api, apiRequest } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { crmKeys, useLead, useProjectOptions } from "@/lib/crm/queries";
import { poishaToTaka, takaToPoisha } from "@/lib/format";
import { useDebounced } from "@/lib/hooks/useDebounced";
import { useSalesError } from "@/lib/sales/errors";
import { addDays, todayDhaka } from "@/lib/sales/money";
import { salesKeys, useAccountSettings, useSalesRefresh } from "@/lib/sales/queries";
import { useSearchState } from "@/lib/sales/url";
import { checkPayment, paymentBody } from "../PaymentFields";
import { localName, useMoney } from "../parts";
import { clearDraft, hasProgress, loadDraft, newDraft, saveDraft } from "./draft";
import { checkNominees, nomineesBody } from "./NomineesEditor";
import { checkSchedule, scheduleBody } from "./ScheduleEditor";
import { StepBuyer } from "./StepBuyer";
import { StepPayment } from "./StepPayment";
import { StepPrice } from "./StepPrice";
import { StepReview } from "./StepReview";
import { StepUnit, UnitWatch, bookable } from "./StepUnit";

const STEPS = ["unit", "buyer", "price", "payment", "review"];

/** Which step owns a server error code (so the user lands where it can be fixed). */
const ERROR_STEP = {
  UNIT_HELD_BY_OTHER: 0, UNIT_STATE_CONFLICT: 0, PROJECT_CODE_REQUIRED: 0, PRICE_NOT_SET: 0,
  INVALID_LEAD: 1,
  DISCOUNT_LIMIT: 2, INVALID_DISCOUNT: 2, PRICE_CHANGED: 2, PLAN_EXCEEDS_PRICE: 2, INVALID_PLAN: 2, SCHEDULE_TOTAL_MISMATCH: 2,
  INVALID_SCHEDULE: 2, CUSTOM_SCHEDULE_NOT_ALLOWED: 2, BOOKING_DATE_IN_FUTURE: 2, BOOKING_DATE_TOO_OLD: 2,
  BOOKING_MONEY_REQUIRED: 3, BOOKING_MONEY_SHORT: 3, OVERPAYMENT: 3, WAIVE_NOT_ALLOWED: 3, INVALID_BANK_ACCOUNT: 3,
  DUPLICATE_CHEQUE: 3, CHEQUE_STALE: 3, INVALID_CHEQUE_DATE: 3,
};
const PATH_STEP = { unitId: 0, customerId: 1, coApplicantIds: 1, nominees: 1, leadId: 1, bookingDate: 2, planId: 2, schedule: 2, discount: 2, payment: 3, waiveReason: 3 };

const noopSubscribe = () => () => {};

/** Start from the URL (unit drawer, lead drawer, customer page) or resume this tab's draft. */
function initialDraft(params) {
  const fromUrl = {
    unitId: params.get("unitId") ?? "",
    leadId: params.get("leadId") ?? "",
    projectId: params.get("projectId") ?? "",
    customerId: params.get("customerId") ?? "",
  };
  const saved = loadDraft();
  const urlAsks = fromUrl.unitId || fromUrl.leadId || fromUrl.customerId || fromUrl.projectId;
  const matches = saved && (!fromUrl.unitId || saved.unitId === fromUrl.unitId) && (!fromUrl.leadId || saved.leadId === fromUrl.leadId);
  if (hasProgress(saved) && (!urlAsks || matches)) return { draft: saved, restored: true };
  return { draft: { ...newDraft(fromUrl), pendingCustomerId: fromUrl.customerId || null }, restored: false };
}

/** /dashboard/bookings/new?unitId&leadId&customerId&projectId — the booking wizard. */
export function BookingWizard() {
  // The draft lives in sessionStorage: render only in the browser (no server/client mismatch).
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!hydrated) return <Skeleton className="mx-auto h-[32rem] w-full max-w-6xl" />;
  return <WizardRoot />;
}

function WizardRoot() {
  const t = useTranslations("sales.wizard");
  const locale = useLocale();
  const router = useRouter();
  const [params] = useSearchState();
  const [start] = useState(() => initialDraft(params));
  const [draft, setDraft] = useState(start.draft);
  const [restored, setRestored] = useState(start.restored);

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard/bookings" className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-3.5" />
        {t("back")}
      </Link>
      <div className="mt-4">
        <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      </div>
      {restored && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface-2/70 px-4 py-3 text-sm">
          <span className="flex-1">{t("restored")}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              clearDraft();
              setRestored(false);
              setDraft(newDraft());
              router.replace("/dashboard/bookings/new");
            }}
          >
            <RotateCcw aria-hidden className="size-3.5" />
            {t("startOver")}
          </Button>
        </div>
      )}
      <Wizard key={draft.key} initial={draft} locale={locale} />
    </div>
  );
}

function Wizard({ initial, locale }) {
  const t = useTranslations("sales.wizard");
  const tc = useTranslations("common");
  const router = useRouter();
  const money = useMoney();
  const salesError = useSalesError();
  const refresh = useSalesRefresh();
  const { user, can } = useSession();
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);
  const top = useRef(null);
  const patch = (p) => {
    setDraft((d) => ({ ...d, ...p }));
    if (!("step" in p)) setErrors((e) => (Object.keys(e).length ? {} : e)); // re-checked on "Continue"
  };

  useEffect(() => saveDraft(draft), [draft]);

  // Pre-fill from a lead (its project / unit of interest), ?customerId and a unit-only link.
  // Fetched once through the query cache; the result patches the draft (never overwrites a choice).
  const qc = useQueryClient();
  const lead = useLead(draft.leadId || null);
  useEffect(() => {
    let live = true;
    if (draft.leadId) {
      qc.fetchQuery({ queryKey: crmKeys.lead(draft.leadId), queryFn: () => api.get(`/leads/${draft.leadId}`) })
        .then((l) => {
          if (!live || !l) return;
          setDraft((d) => {
            const projectId = d.projectId || l.interest?.projectId || "";
            const sameProject = l.interest?.unitId && projectId === l.interest.projectId;
            return { ...d, projectId, unitId: d.unitId || (sameProject ? l.interest.unitId : "") };
          });
        })
        .catch(() => {});
    }
    if (draft.pendingCustomerId) {
      qc.fetchQuery({ queryKey: salesKeys.customer(draft.pendingCustomerId), queryFn: () => api.get(`/customers/${draft.pendingCustomerId}`) })
        .then((c) => live && setDraft((d) => ({ ...d, customer: d.customer ?? c, pendingCustomerId: null })))
        .catch(() => live && setDraft((d) => ({ ...d, pendingCustomerId: null })));
    }
    if (draft.unitId && !draft.projectId) {
      qc.fetchQuery({ queryKey: ["unit", draft.unitId], queryFn: () => api.get(`/units/${draft.unitId}`) })
        .then((u) => live && u?.projectId && setDraft((d) => (d.projectId ? d : { ...d, projectId: u.projectId })))
        .catch(() => {});
    }
    return () => {
      live = false;
    };
    // Only on first mount: these are the entry links, later changes are the user's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const projects = useProjectOptions();
  const project = (projects.data ?? []).find((p) => p.id === draft.projectId);
  const units = useAllUnits(draft.projectId || null);
  useLiveInventory(draft.projectId || null);
  const unit = (units.data ?? []).find((u) => u.id === draft.unitId) ?? null;
  const settings = useAccountSettings();

  // ── Live preview (server quote; writes nothing) ──
  const discount = takaToPoisha(draft.discountAmount) ?? 0;
  const customCheck = checkSchedule(draft.schedule, null, draft.bookingDate);
  const customReady = draft.planMode === "custom" && draft.schedule.length > 0 && !Object.keys(customCheck.errors).some((k) => k !== "total");
  const previewInput = useMemo(() => {
    if (!draft.unitId) return null;
    const base = {
      unitId: draft.unitId,
      bookingDate: draft.bookingDate || undefined,
      // The preview needs a reason with a discount; the real one is checked before saving.
      ...(discount > 0 && { discount: { amount: discount, reason: draft.discountReason.trim().length >= 3 ? draft.discountReason.trim() : "preview" } }),
    };
    if (customReady) return { ...base, schedule: scheduleBody(draft.schedule) };
    if (draft.planId) return { ...base, planId: draft.planId };
    return null;
  }, [draft.unitId, draft.bookingDate, draft.planId, draft.schedule, draft.discountReason, discount, customReady]);
  const debouncedInput = useDebounced(previewInput, 350);
  const preview = useQuery({
    queryKey: ["bookings", "preview", debouncedInput],
    queryFn: () => apiRequest("/bookings/preview", { method: "POST", body: debouncedInput }).then((r) => r.data),
    enabled: Boolean(debouncedInput),
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
  });
  const p = debouncedInput ? preview.data : undefined;
  const previewView = { ...preview, data: p };

  // ── Step checks ──
  const validate = (step) => {
    const e = {};
    if (step === 0) {
      if (!draft.unitId) e.unit = "chooseUnit";
      else if (unit && !bookable(unit, user, can)) e.unit = "unitGone";
      if (project && !project.code) e.unit = "projectCode";
    }
    if (step === 1) {
      if (!draft.customer) e.customer = "chooseCustomer";
      const n = checkNominees(draft.nominees);
      if (Object.keys(n).length) e.nominees = n;
    }
    if (step === 2) {
      const today = todayDhaka();
      const min = addDays(today, -(settings.data?.receiptBackdateDays ?? 31));
      if (!draft.bookingDate || draft.bookingDate > today) e.bookingDate = "dateFuture";
      else if (draft.bookingDate < min) e.bookingDate = "dateTooOld";
      if (draft.planMode === "template" && !draft.planId) e.planId = "choosePlan";
      if (draft.planMode === "custom") {
        const c = checkSchedule(draft.schedule, p?.price?.contractTotal ?? null, draft.bookingDate);
        if (Object.keys(c.errors).length) e.schedule = "scheduleInvalid";
      }
      if (takaToPoisha(draft.discountAmount || "0") == null) e.discountAmount = "amount";
      if (discount > 0 && draft.discountReason.trim().length < 3) e.discountReason = "reason3";
      if (!p || preview.isError || preview.isFetching || debouncedInput !== previewInput) e.preview = "previewPending";
    }
    if (step === 3) {
      if (draft.payMode === "pay") {
        const pe = checkPayment(draft.payment, { min: p?.bookingMoney || undefined, max: p?.price?.contractTotal });
        if (draft.payment.mode === "cheque" && draft.payment.chequeDate && draft.payment.chequeDate < draft.bookingDate) pe.chequeDate = "chequeBeforeBooking";
        if (Object.keys(pe).length) e.payment = pe;
      }
      if (draft.payMode === "waive" && draft.waiveReason.trim().length < 3) e.waiveReason = "reason3";
    }
    return e;
  };

  const go = (step) => {
    setSubmitError(null);
    setErrors({});
    patch({ step });
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const next = () => {
    const e = validate(draft.step);
    setErrors(e);
    if (Object.keys(e).length) return;
    // Entering "booking money": start from the plan's booking money amount.
    if (draft.step === 2 && !draft.payment.amount && p?.bookingMoney) patch({ payment: { ...draft.payment, amount: poishaToTaka(p.bookingMoney) } });
    go(draft.step + 1);
  };
  const canOpen = (i) => i <= draft.step || STEPS.slice(0, i).every((_, j) => !Object.keys(validate(j)).length);

  // ── Save (one transaction on the server; the Idempotency-Key makes a retry safe) ──
  const submit = async () => {
    for (let s = 0; s < 4; s += 1) {
      const e = validate(s);
      if (Object.keys(e).length) {
        patch({ step: s });
        setErrors(e);
        return;
      }
    }
    const body = {
      unitId: draft.unitId,
      customerId: draft.customer.id,
      ...(draft.coApplicants.length && { coApplicantIds: draft.coApplicants.map((c) => c.id) }),
      ...(draft.nominees.length && { nominees: nomineesBody(draft.nominees) }),
      ...(draft.leadId && { leadId: draft.leadId }),
      bookingDate: draft.bookingDate,
      ...(draft.planMode === "custom" ? { schedule: scheduleBody(draft.schedule) } : { planId: draft.planId }),
      ...(discount > 0 && { discount: { amount: discount, reason: draft.discountReason.trim() } }),
      expectedTotal: p.price.listTotal,
      ...(draft.payMode === "pay" && { payment: paymentBody(draft.payment) }),
      ...(draft.payMode === "waive" && { waiveReason: draft.waiveReason.trim() }),
      ...(draft.note.trim() && { note: draft.note.trim() }),
    };
    setBusy(true);
    setSubmitError(null);
    try {
      const { data: booking } = await apiRequest("/bookings", { method: "POST", body, headers: { "Idempotency-Key": draft.key } });
      clearDraft();
      refresh({ bookingId: booking.id, projectId: draft.projectId, unitId: draft.unitId, customerId: draft.customer.id });
      router.replace(`/dashboard/bookings/${booking.id}?created=1`);
    } catch (err) {
      setBusy(false);
      const code = err?.code;
      let step = ERROR_STEP[code];
      if (step === undefined && code === "VALIDATION_ERROR") {
        const first = err.details?.[0]?.path?.split(".")[0];
        step = PATH_STEP[first];
      }
      if (code === "PRICE_CHANGED") preview.refetch();
      if (["UNIT_STATE_CONFLICT", "UNIT_HELD_BY_OTHER"].includes(code)) units.refetch();
      if (code === "IDEMPOTENCY_KEY_REUSED") patch({ key: newDraft().key });
      setSubmitError(salesError(err, locale));
      if (step !== undefined) patch({ step });
    }
  };

  const contract = p?.price?.contractTotal;
  const stepProps = { draft, patch, errors, preview: previewView };

  return (
    <div ref={top} className="grid scroll-mt-6 grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label={t("stepsLabel")} className="min-w-0 lg:sticky lg:top-6 lg:self-start">
        <ol className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-1 lg:overflow-visible">
          {STEPS.map((s, i) => {
            const done = i < draft.step;
            const current = i === draft.step;
            return (
              <li key={s} className="shrink-0">
                <button
                  type="button"
                  disabled={!canOpen(i) || busy}
                  onClick={() => go(i)}
                  aria-current={current ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed",
                    current ? "bg-primary text-primary-ink" : "text-ink-muted enabled:hover:bg-surface-2 enabled:hover:text-ink",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full border font-mono text-[11px]",
                      current ? "border-primary-ink/40" : done ? "border-success bg-success text-white" : "border-line-strong",
                    )}
                  >
                    {done ? <Check aria-hidden className="size-3.5" /> : i + 1}
                  </span>
                  <span className="whitespace-nowrap">{t(`steps.${s}`)}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {(unit || draft.customer || contract != null) && (
          <dl className="mt-6 hidden space-y-3 border-t border-line pt-5 text-sm lg:block">
            {unit && (
              <div>
                <dt className="text-[11px] tracking-wide text-ink-subtle uppercase">{t("summary.unit")}</dt>
                <dd className="mt-0.5 font-mono">{unit.code}</dd>
                <dd className="truncate text-xs text-ink-muted">{localName(project, locale)}</dd>
              </div>
            )}
            {draft.customer && (
              <div>
                <dt className="text-[11px] tracking-wide text-ink-subtle uppercase">{t("summary.buyer")}</dt>
                <dd className="mt-0.5 truncate">{localName(draft.customer, locale)}</dd>
              </div>
            )}
            {contract != null && (
              <div>
                <dt className="text-[11px] tracking-wide text-ink-subtle uppercase">{t("summary.contract")}</dt>
                <dd className="mt-0.5 font-mono tabular-nums">{money(contract)}</dd>
              </div>
            )}
          </dl>
        )}
      </nav>

      <section className="min-w-0 rounded-lg border border-line bg-surface p-5 sm:p-7">
        <header className="mb-6">
          <p className="eyebrow">{t("stepOf", { n: draft.step + 1, total: STEPS.length })}</p>
          <h3 className="mt-2 font-display text-2xl">{t(`titles.${STEPS[draft.step]}`)}</h3>
        </header>

        {draft.step > 0 && unit && (
          <div className="mb-6">
            <UnitWatch unit={unit} onChange={() => go(0)} />
          </div>
        )}
        {submitError && (
          <p role="alert" className="mb-6 rounded-md border border-danger/30 bg-danger-bg px-4 py-3 text-sm">
            {submitError}
          </p>
        )}
        {errors.unit && <ErrorLine k={errors.unit} />}
        {errors.preview && <ErrorLine k={errors.preview} />}
        {errors.schedule && <ErrorLine k={errors.schedule} />}

        {draft.step === 0 && <StepUnit {...stepProps} units={units} />}
        {draft.step === 1 && <StepBuyer {...stepProps} lead={lead.data} />}
        {draft.step === 2 && <StepPrice {...stepProps} />}
        {draft.step === 3 && <StepPayment {...stepProps} />}
        {draft.step === 4 && <StepReview {...stepProps} unit={unit} project={project} />}

        <footer className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
          <Button variant="ghost" disabled={draft.step === 0 || busy} onClick={() => go(draft.step - 1)}>
            {t("prev")}
          </Button>
          {draft.step < STEPS.length - 1 ? (
            <Button onClick={next}>{t("next")}</Button>
          ) : (
            <Button variant="accent" size="lg" loading={busy || preview.isFetching || debouncedInput !== previewInput} onClick={submit}>
              {t("confirm")}
            </Button>
          )}
        </footer>
        {draft.step === STEPS.length - 1 && <p className="mt-3 text-right text-xs text-ink-muted">{t("confirmHint")}</p>}
        <p className="sr-only" aria-live="polite">
          {busy ? tc("loading") : ""}
        </p>
      </section>
    </div>
  );
}

function ErrorLine({ k }) {
  const tv = useTranslations("sales.validation");
  return (
    <p role="alert" className="mb-6 rounded-md border border-danger/30 bg-danger-bg px-4 py-3 text-sm">
      {tv(k)}
    </p>
  );
}

