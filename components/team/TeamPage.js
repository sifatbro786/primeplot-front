"use client";

import { useState } from "react";
import { Plus, Search, Users } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { initials } from "@/components/shell/UserMenu";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { apiRequest } from "@/lib/api/client";
import { errorMessage, useSession } from "@/lib/auth/session";
import { formatDate, formatPhone } from "@/lib/format";
import { useDebounced } from "@/lib/hooks/useDebounced";
import { UserDrawer } from "./UserDrawer";

export const ROLES = ["admin", "sales_manager", "sales_executive", "client"];
const STATUS_TONE = { active: "success", invited: "warning", disabled: "neutral" };

export function TeamPage() {
  const t = useTranslations("team");
  const tr = useTranslations("roles");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const { can, user: me } = useSession();
  const canManage = can("users:manage");

  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState(null); // { mode: 'invite' } | { mode: 'edit', user }
  const search = useDebounced(q.trim());

  const query = { q: search.length ? search : undefined, role: role || undefined, status: status || undefined, page, limit: 20 };
  const list = useQuery({
    queryKey: ["users", query],
    queryFn: () => apiRequest("/users", { query }),
    placeholderData: keepPreviousData,
  });

  const filter = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  const rows = list.data?.data ?? [];
  const filtered = Boolean(search || role || status);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          canManage && (
            <Button onClick={() => setDrawer({ mode: "invite" })}>
              <Plus aria-hidden className="size-4" />
              {t("invite")}
            </Button>
          )
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_180px_160px]">
        <Input
          leading={<Search className="size-4" />}
          placeholder={t("searchPlaceholder")}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          aria-label={t("searchPlaceholder")}
        />
        <Select value={role} onChange={filter(setRole)} aria-label={t("role")}>
          <option value="">{t("allRoles")}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {tr(r)}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={filter(setStatus)} aria-label={t("status")}>
          <option value="">{t("allStatuses")}</option>
          {["active", "invited", "disabled"].map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </Select>
      </div>

      {list.isError ? (
        <ErrorState
          title={t("loadFailed")}
          description={errorMessage(te, list.error)}
          requestId={list.error?.requestId}
          requestIdLabel={tc("requestId")}
          action={
            <Button size="sm" variant="secondary" onClick={() => list.refetch()}>
              {tc("retry")}
            </Button>
          }
        />
      ) : list.isPending ? (
        <Skeleton className="h-72 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filtered ? t("noMatches") : t("emptyTitle")}
          description={filtered ? t("noMatchesBody") : t("emptyBody")}
        />
      ) : (
        <>
          <Table aria-busy={list.isFetching || undefined}>
            <THead>
              <tr>
                <TH>{t("member")}</TH>
                <TH className="hidden md:table-cell">{t("phone")}</TH>
                <TH>{t("role")}</TH>
                <TH>{t("status")}</TH>
                <TH className="hidden lg:table-cell">{t("lastLogin")}</TH>
                {canManage && <TH align="right">
                  <span className="sr-only">{t("actions")}</span>
                </TH>}
              </tr>
            </THead>
            <TBody>
              {rows.map((u) => (
                <TR key={u.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-3 text-[11px] font-semibold text-ink-muted">
                        {initials(u.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {u.name}
                          {u.id === me?.id && <span className="ml-2 text-xs font-normal text-ink-subtle">{t("you")}</span>}
                        </p>
                        <p className="truncate text-xs text-ink-muted">{u.email}</p>
                      </div>
                    </div>
                  </TD>
                  <TD className="hidden font-mono text-[13px] text-ink-muted md:table-cell">{u.phone ? formatPhone(u.phone, locale) : "—"}</TD>
                  <TD>{tr(u.role)}</TD>
                  <TD>
                    <Tag tone={STATUS_TONE[u.status]}>{t(`statuses.${u.status}`)}</Tag>
                  </TD>
                  <TD className="hidden text-xs text-ink-muted lg:table-cell">
                    {u.lastLoginAt ? formatDate(u.lastLoginAt, locale, "datetime") : t("never")}
                  </TD>
                  {canManage && (
                    <TD align="right">
                      <Button size="sm" variant="ghost" onClick={() => setDrawer({ mode: "edit", user: u })}>
                        {t("edit")}
                      </Button>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
          <Pagination meta={list.data?.meta} onPage={setPage} />
        </>
      )}

      {canManage && <UserDrawer state={drawer} onClose={() => setDrawer(null)} meId={me?.id} />}
    </div>
  );
}
