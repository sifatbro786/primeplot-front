"use client";

import { useState } from "react";
import { Plus, Search, UsersRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Link, useRouter } from "@/i18n/navigation";
import { useSession } from "@/lib/auth/session";
import { formatPhone } from "@/lib/format";
import { useDebounced } from "@/lib/hooks/useDebounced";
import { useSalesError } from "@/lib/sales/errors";
import { useCustomers } from "@/lib/sales/queries";
import { useSearchState } from "@/lib/sales/url";
import { CustomerDrawer } from "./CustomerDrawer";
import { CustomerPhoto } from "./PrivateFiles";
import { localName, useDate } from "./parts";

/** /dashboard/customers — buyer profiles (executives see the ones they created or sold to). */
export function CustomersPage() {
  const t = useTranslations("sales.customers");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const date = useDate();
  const salesError = useSalesError();
  const { can } = useSession();
  const [params, write] = useSearchState();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [creating, setCreating] = useState(false);
  const page = Number(params.get("page")) || 1;
  const debounced = useDebounced(q.trim(), 300);
  const list = useCustomers({ q: debounced || undefined, page, limit: 25 });
  const rows = list.data?.data ?? [];

  const search = (v) => {
    setQ(v);
    write({ q: v.trim() || null, page: null });
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          can("bookings:create") && (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden className="size-4" />
              {t("new")}
            </Button>
          )
        }
      />

      <div className="mb-5 max-w-md">
        <Input value={q} onChange={(e) => search(e.target.value)} placeholder={t("picker.search")} aria-label={t("picker.search")} leading={<Search className="size-4" />} />
      </div>

      {list.isError ? (
        <ErrorState title={t("loadFailed")} description={salesError(list.error, locale)} requestId={list.error?.requestId} requestIdLabel={tc("requestId")} />
      ) : list.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={debounced ? t("noMatches") : t("emptyTitle")}
          description={debounced ? undefined : t("emptyBody")}
          action={
            !debounced &&
            can("bookings:create") && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus aria-hidden className="size-4" />
                {t("new")}
              </Button>
            )
          }
        />
      ) : (
        <>
          <Table aria-busy={list.isFetching || undefined}>
            <THead>
              <tr>
                <TH>{t("cols.customer")}</TH>
                <TH>{t("cols.phone")}</TH>
                <TH className="hidden md:table-cell">{t("cols.nid")}</TH>
                <TH className="hidden lg:table-cell">{t("cols.created")}</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((c) => (
                <TR key={c.id} className="cursor-pointer" onClick={() => router.push(`/dashboard/customers/${c.id}`)}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <CustomerPhoto mediaId={c.photoMediaId} className="size-8" />
                      <div className="min-w-0">
                        <Link href={`/dashboard/customers/${c.id}`} className="block truncate font-medium hover:underline">
                          {localName(c, locale)}
                        </Link>
                        <span className="font-mono text-[11px] text-ink-subtle">{c.customerNo}</span>
                      </div>
                    </div>
                  </TD>
                  <TD className="font-mono text-[13px]">{formatPhone(c.phone, locale)}</TD>
                  <TD className="hidden font-mono text-[13px] md:table-cell">{c.nid ?? c.passportNo ?? "—"}</TD>
                  <TD className="hidden text-ink-muted lg:table-cell">{date(c.createdAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination meta={list.data?.meta} onPage={(p) => write({ page: p > 1 ? p : null })} />
        </>
      )}

      <CustomerDrawer
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(c) => {
          setCreating(false);
          router.push(`/dashboard/customers/${c.id}`);
        }}
      />
    </div>
  );
}
