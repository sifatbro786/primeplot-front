"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { useSearchState } from "@/lib/sales/url";
import { AccountSettingsPanel } from "./AccountSettingsPanel";
import { BankAccountsPanel } from "./BankAccountsPanel";
import { PlansPanel } from "./PlansPanel";

const TABS = ["plans", "banks", "settings"];

/** /dashboard/accounts — payment plan templates, company bank accounts, accounts settings (?tab=). */
export function AccountsPage() {
  const t = useTranslations("sales.accounts");
  const { can } = useSession();
  const [params, write] = useSearchState();
  const tab = TABS.includes(params.get("tab")) ? params.get("tab") : "plans";
  const canBanks = can("accounts:read", "bookings:read_all");

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <nav aria-label={t("tabsLabel")} className="mb-8 flex gap-6 overflow-x-auto border-b border-line">
        {TABS.filter((k) => k === "plans" || canBanks).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => write({ tab: k === "plans" ? null : k })}
            aria-current={tab === k ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 pb-3 text-sm font-medium whitespace-nowrap transition-colors",
              tab === k ? "border-primary text-ink" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {t(`tabs.${k}`)}
          </button>
        ))}
      </nav>
      {tab === "plans" && <PlansPanel />}
      {tab === "banks" && <BankAccountsPanel />}
      {tab === "settings" && <AccountSettingsPanel />}
    </div>
  );
}
