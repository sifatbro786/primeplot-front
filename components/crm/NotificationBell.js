"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "@/components/ui/Toast";
import { useRouter } from "@/i18n/navigation";
import { api, apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { crmKeys } from "@/lib/crm/queries";
import { formatDate } from "@/lib/format";
import { useStaffEvent } from "@/lib/socket";
import { useNum } from "./parts";

/** Notification → { text, href } in the viewer's language. */
export function useNotificationText() {
  const t = useTranslations("crm.notifications");
  const ti = useTranslations("crm.notifications.integrations");
  return (n) => {
    const d = n.data ?? {};
    const lead = d.leadId ? `/dashboard/leads?lead=${d.leadId}` : null;
    switch (n.type) {
      case "lead.assigned":
        return { text: t("assigned", { name: d.name ?? "—" }), href: lead };
      case "lead.enquiry":
        return { text: t("enquiry", { name: d.name ?? "—" }), href: lead };
      case "lead.unassigned":
        return { text: t("unassigned", { name: d.name ?? "—" }), href: lead };
      case "task.due":
        return { text: t("taskDue", { title: d.title ?? "—", name: d.leadName ?? "—" }), href: lead };
      case "lead.sla_breached":
        return { text: d.assigneeName ? t("slaOwner", { name: d.name ?? "—", owner: d.assigneeName }) : t("sla", { name: d.name ?? "—" }), href: lead };
      case "integration.error":
        return { text: t("integration", { integration: ti.has(d.integration) ? ti(d.integration) : d.integration, message: d.message ?? "" }), href: "/dashboard/integrations" };
      case "cheque.bounced":
        return {
          text: t("chequeBounced", { no: d.chequeNo ?? "—", name: d.customerName ?? "—", booking: d.bookingNo ?? "" }),
          href: d.bookingId ? `/dashboard/bookings/${d.bookingId}?tab=receipts` : "/dashboard/cheques",
        };
      default:
        return { text: n.type, href: null };
    }
  };
}

/** Topbar bell: unread count, latest 20, live over Socket.IO (personal channel). */
export function NotificationBell() {
  const t = useTranslations("crm.notifications");
  const locale = useLocale();
  const qc = useQueryClient();
  const router = useRouter();
  const num = useNum();
  const textOf = useNotificationText();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const unread = useQuery({ queryKey: crmKeys.unread, queryFn: () => api.get("/notifications/unread-count"), refetchInterval: 5 * 60_000 });
  const list = useQuery({
    queryKey: crmKeys.notifications,
    queryFn: async () => (await apiRequest("/notifications", { query: { limit: 20 } })).data,
    enabled: open,
  });

  useStaffEvent(
    "notification",
    (n) => {
      qc.setQueryData(crmKeys.unread, (c) => ({ count: (c?.count ?? 0) + 1 }));
      qc.setQueryData(crmKeys.notifications, (old) => (Array.isArray(old) ? [n, ...old.filter((x) => x.id !== n.id)].slice(0, 20) : old));
      toast(textOf(n).text);
      if (n.type?.startsWith("lead.") || n.type === "task.due") {
        qc.invalidateQueries({ queryKey: ["leads"] });
        qc.invalidateQueries({ queryKey: ["tasks"] });
      }
    },
    { onReconnect: () => qc.invalidateQueries({ queryKey: ["notifications"] }) },
  );

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const markRead = async (body) => {
    try {
      await api.post("/notifications/read", body);
    } finally {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
  };

  const count = unread.data?.count ?? 0;
  const items = list.data ?? [];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={count ? t("labelUnread", { n: num(count) }) : t("label")}
        className="relative grid size-10 place-items-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink"
      >
        <Bell className="size-[18px]" strokeWidth={1.7} />
        {count > 0 && (
          <span className="absolute top-1.5 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 font-mono text-[9px] font-semibold text-white">
            {count > 99 ? "99+" : num(count)}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("title")}
          className="toast-in absolute right-0 z-40 mt-2 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-lg border border-line bg-surface shadow-[0_16px_40px_-18px_rgb(28_29_26_/_0.35)]"
        >
          <header className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">{t("title")}</h2>
            {count > 0 && (
              <button type="button" onClick={() => markRead({ all: true })} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                <CheckCheck aria-hidden className="size-3.5" />
                {t("markAll")}
              </button>
            )}
          </header>
          <div className="max-h-[60dvh] overflow-y-auto">
            {list.isPending ? (
              <div className="grid place-items-center py-10">
                <Spinner />
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-ink-muted">{t("empty")}</p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((n) => {
                  const { text, href } = textOf(n);
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => {
                          if (!n.readAt) markRead({ ids: [n.id] });
                          setOpen(false);
                          if (href) router.push(href);
                        }}
                        className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-2", !n.readAt && "bg-accent-soft/60")}
                      >
                        <span aria-hidden className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-accent")} />
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm leading-snug", ["lead.sla_breached", "integration.error", "cheque.bounced"].includes(n.type) ? "text-danger" : "")}>{text}</span>
                          <span className="mt-0.5 block text-[11px] text-ink-subtle">{formatDate(n.createdAt, locale, "datetime")}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
