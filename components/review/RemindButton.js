"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMoney } from "@/components/sales/parts";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { useReviewError } from "./parts";

/**
 * Booking › "Remind now": SMS + e-mail to the holder for everything due/overdue (or the next
 * item). The API allows one per booking per day (409 ALREADY_REMINDED_TODAY).
 */
export function RemindButton({ b }) {
  const t = useTranslations("review.remind");
  const money = useMoney();
  const reviewError = useReviewError();
  const { can } = useSession();
  const [busy, setBusy] = useState(false);
  const [sentToday, setSentToday] = useState(false);
  if (b.status !== "active" || !(b.totals?.outstanding > 0) || !can("reminders:manage", "receipts:create")) return null;

  const remind = async () => {
    setBusy(true);
    try {
      const log = await api.post(`/bookings/${b.id}/remind`);
      setSentToday(true);
      const via = [log.sms?.status === "queued" && t("sms"), log.email?.status === "queued" && t("email")].filter(Boolean).join(" + ");
      if (via) toast.success(t("sent", { amount: money(log.amount), via }));
      else toast(t("nothingSent", { reason: log.sms?.reason ?? log.email?.reason ?? "—" }));
    } catch (err) {
      if (err?.code === "ALREADY_REMINDED_TODAY") setSentToday(true);
      toast.error(reviewError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="secondary" onClick={remind} loading={busy} disabled={sentToday} title={sentToday ? t("doneToday") : t("hint")}>
      <BellRing aria-hidden className="size-4" />
      {sentToday ? t("doneToday") : t("label")}
    </Button>
  );
}
