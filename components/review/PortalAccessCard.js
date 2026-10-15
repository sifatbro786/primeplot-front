"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useDate } from "@/components/sales/parts";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/States";
import { Tag } from "@/components/ui/Tag";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { useSession } from "@/lib/auth/session";
import { reviewKeys, useCustomerPortal } from "@/lib/review/queries";
import { useReviewError } from "./parts";

const TONE = { none: "neutral", invited: "info", active: "success", disabled: "danger" };

/** Customer page › Portal login: status, invite / resend, switch off / on (B5.1). */
export function PortalAccessCard({ customerId, onBooking = true }) {
  const t = useTranslations("review.access");
  const date = useDate();
  const reviewError = useReviewError();
  const qc = useQueryClient();
  const { can } = useSession();
  const q = useCustomerPortal(customerId);
  const [busy, setBusy] = useState(null);
  const [offerForce, setOfferForce] = useState(false);
  const s = q.data;

  const set = (data) => qc.setQueryData(reviewKeys.portal(customerId), data);

  const invite = async (force = false) => {
    setBusy("invite");
    try {
      const r = await api.post(`/customers/${customerId}/portal/invite`, { force });
      set(r.portal);
      if (r.reason === "recently_sent") {
        setOfferForce(true);
        toast(t("recent"));
      } else if (r.reason === "no_channel") toast.error(t("noChannel"));
      else if (r.reason === "already_active") toast(t("alreadyActive"));
      else if (r.reason === "disabled") toast(t("isDisabled"));
      else {
        setOfferForce(false);
        const via = [r.sent?.sms && t("viaSms"), r.sent?.email && t("viaEmail")].filter(Boolean).join(" + ");
        toast.success(r.created ? t("created", { via }) : t("resent", { via }));
      }
    } catch (err) {
      toast.error(reviewError(err));
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (enabled) => {
    setBusy("toggle");
    try {
      set(await api.patch(`/customers/${customerId}/portal`, { enabled }));
      toast.success(enabled ? t("enabled") : t("disabledDone"));
    } catch (err) {
      toast.error(reviewError(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      <h3 className="mb-4 text-sm font-semibold">{t("title")}</h3>
      <div className="space-y-4 rounded-lg border border-line bg-surface p-5">
        {q.isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : q.isError ? (
          <p className="text-sm text-ink-muted">{reviewError(q.error)}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm">
                <KeyRound aria-hidden className="size-4 text-accent" />
                {t("label")}
              </span>
              <Tag tone={TONE[s.status]}>{t(`status.${s.status}`)}</Tag>
            </div>
            {s.login && (s.login.phone || s.login.email) && (
              <p className="font-mono text-[12px] text-ink-muted">{[s.login.phone, s.login.email].filter(Boolean).join(" · ")}</p>
            )}
            <ul className="space-y-1 text-xs text-ink-muted">
              {s.lastLoginAt && <li>{t("lastLogin", { date: date(s.lastLoginAt, "datetime") })}</li>}
              {s.status === "invited" && s.inviteSentAt && <li>{t("inviteSent", { date: date(s.inviteSentAt, "datetime") })}</li>}
              {s.status === "invited" && s.inviteExpiresAt && <li>{t("inviteExpires", { date: date(s.inviteExpiresAt, "datetime") })}</li>}
              {s.status === "none" && <li>{onBooking ? t("noneHint") : t("noBookingHint")}</li>}
            </ul>
            <div className="flex flex-wrap gap-2">
              {can("bookings:create") && ["none", "invited"].includes(s.status) && onBooking && (
                <Button size="sm" variant="secondary" loading={busy === "invite"} disabled={Boolean(busy)} onClick={() => invite(offerForce)}>
                  {s.status === "none" ? t("invite") : offerForce ? t("sendAnyway") : t("resend")}
                </Button>
              )}
              {can("portal:manage") && s.status === "active" && (
                <Button size="sm" variant="ghost" className="text-danger" loading={busy === "toggle"} disabled={Boolean(busy)} onClick={() => toggle(false)}>
                  {t("disable")}
                </Button>
              )}
              {can("portal:manage") && s.status === "disabled" && (
                <Button size="sm" variant="secondary" loading={busy === "toggle"} disabled={Boolean(busy)} onClick={() => toggle(true)}>
                  {t("enable")}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
