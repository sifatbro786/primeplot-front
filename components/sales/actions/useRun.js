"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "@/components/ui/Toast";
import { useSalesError } from "@/lib/sales/errors";
import { useSalesRefresh } from "@/lib/sales/queries";

/**
 * Busy/error state for one booking action. run(call, okMessage) → result or undefined.
 * Shows the API's warnings (stage changes return `meta.warnings`) as toasts and refreshes
 * every booking / cheque / report view afterwards.
 */
export function useRun(booking) {
  const locale = useLocale();
  const tw = useTranslations("sales.warnings");
  const salesError = useSalesError();
  const refresh = useSalesRefresh();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = async (call, okMessage) => {
    setBusy(true);
    setError(null);
    try {
      const r = await call();
      for (const w of r?.meta?.warnings ?? []) toast.info(tw.has(w) ? tw(w) : w, { duration: 9000 });
      if (okMessage) toast.success(okMessage);
      refresh({ bookingId: booking?.id, projectId: booking?.project?.id, unitId: booking?.unitId, customerId: booking?.customerId });
      return r ?? true;
    } catch (err) {
      if (err?.code === "STALE_VERSION") refresh({ bookingId: booking?.id });
      setError(salesError(err, locale));
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

export function ErrorBox({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-md border border-danger/30 bg-danger-bg px-4 py-3 text-sm">
      {children}
    </p>
  );
}
