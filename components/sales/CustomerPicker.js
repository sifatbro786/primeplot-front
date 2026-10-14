"use client";

import { useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/States";
import { useSession } from "@/lib/auth/session";
import { formatPhone } from "@/lib/format";
import { useDebounced } from "@/lib/hooks/useDebounced";
import { useCustomers } from "@/lib/sales/queries";
import { CustomerDrawer } from "./CustomerDrawer";
import { CustomerPhoto } from "./PrivateFiles";
import { localName } from "./parts";

/** One chosen customer as a compact card (with a remove button when `onClear`). */
export function CustomerCard({ customer, onClear, label }) {
  const locale = useLocale();
  const t = useTranslations("sales.customers");
  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5">
      <CustomerPhoto mediaId={customer.photoMediaId} className="size-10" />
      <div className="min-w-0 flex-1">
        {label && <p className="text-[11px] font-medium tracking-wide text-ink-subtle uppercase">{label}</p>}
        <p className="truncate text-sm font-medium">{localName(customer, locale)}</p>
        <p className="font-mono text-[11px] text-ink-muted">
          {customer.customerNo} · {formatPhone(customer.phone, locale)}
        </p>
      </div>
      {onClear && (
        <button type="button" onClick={onClear} className="rounded-sm p-1.5 text-ink-subtle hover:bg-surface-2 hover:text-ink" aria-label={t("picker.remove")}>
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}

/**
 * Search existing customers (name, number, NID/passport, phone in any form) or create one.
 * onPick(customer). `exclude` hides already chosen ids. `preset` pre-fills "new customer".
 */
export function CustomerPicker({ onPick, exclude = [], preset, initialQuery = "", autoFocus }) {
  const t = useTranslations("sales.customers.picker");
  const locale = useLocale();
  const { can } = useSession();
  const [q, setQ] = useState(initialQuery);
  const [creating, setCreating] = useState(false);
  const debounced = useDebounced(q.trim(), 300);
  const list = useCustomers({ q: debounced, limit: 8 }, { enabled: debounced.length >= 2 });
  const rows = (list.data?.data ?? []).filter((c) => !exclude.includes(c.id));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            leading={<Search className="size-4" />}
            autoFocus={autoFocus}
          />
        </div>
        {can("bookings:create") && (
          <Button variant="secondary" onClick={() => setCreating(true)}>
            <Plus aria-hidden className="size-4" />
            <span className="hidden sm:inline">{t("new")}</span>
          </Button>
        )}
      </div>

      {debounced.length >= 2 && (
        <div className="rounded-md border border-line bg-surface" aria-live="polite">
          {list.isPending ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-2/3" />
            </div>
          ) : rows.length === 0 ? (
            <p className="px-4 py-5 text-sm text-ink-muted">{t("none")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => onPick(c)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2">
                    <CustomerPhoto mediaId={c.photoMediaId} className="size-8" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{localName(c, locale)}</span>
                      <span className="block font-mono text-[11px] text-ink-muted">
                        {c.customerNo} · {formatPhone(c.phone, locale)}
                        {c.nid ? ` · NID ${c.nid}` : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <CustomerDrawer
        open={creating}
        preset={preset}
        onClose={() => setCreating(false)}
        onSaved={(c) => {
          setCreating(false);
          onPick(c);
        }}
      />
    </div>
  );
}
