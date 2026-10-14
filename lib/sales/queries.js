"use client";

import { useCallback } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiRequest } from "@/lib/api/client";

/** Query keys + fetchers for sales & accounts (contract: API.md › B4.1 / B4.2). */
export const salesKeys = {
  customers: (q) => ["customers", "list", q ?? {}],
  customer: (id) => ["customers", "one", id],
  bookings: (q) => ["bookings", "list", q ?? {}],
  booking: (id) => ["bookings", "one", id],
  ledger: (id) => ["bookings", "ledger", id],
  plans: (q) => ["payment-plans", q ?? {}],
  settings: ["accounts", "settings"],
  banks: (q) => ["accounts", "banks", q ?? {}],
  cheques: (q) => ["cheques", "list", q ?? {}],
  documents: (bookingId) => ["bookings", "documents", bookingId],
  document: (id) => ["documents", id],
  report: (kind, q) => ["reports", kind, q ?? {}],
};

export function clean(q) {
  return Object.fromEntries(Object.entries(q ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== ""));
}

/** Offset list → { data, meta }. */
export function useCustomers(query, { enabled = true } = {}) {
  const q = clean(query);
  return useQuery({
    queryKey: salesKeys.customers(q),
    queryFn: () => apiRequest("/customers", { query: q }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useCustomer(id) {
  return useQuery({ queryKey: salesKeys.customer(id), queryFn: () => api.get(`/customers/${id}`), enabled: Boolean(id) });
}

export function useBookings(query, { enabled = true } = {}) {
  const q = clean(query);
  return useQuery({
    queryKey: salesKeys.bookings(q),
    queryFn: () => apiRequest("/bookings", { query: q }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useBooking(id) {
  return useQuery({ queryKey: salesKeys.booking(id), queryFn: () => api.get(`/bookings/${id}`), enabled: Boolean(id) });
}

export function useLedger(id, { enabled = true } = {}) {
  return useQuery({ queryKey: salesKeys.ledger(id), queryFn: () => api.get(`/bookings/${id}/ledger`), enabled: Boolean(id) && enabled });
}

/** Plan templates; with projectId → that project's + company-wide ones. */
export function usePlans(query, { enabled = true } = {}) {
  const q = clean(query);
  return useQuery({ queryKey: salesKeys.plans(q), queryFn: () => api.get("/payment-plans", { query: q }), enabled });
}

export function useAccountSettings({ enabled = true } = {}) {
  return useQuery({ queryKey: salesKeys.settings, queryFn: () => api.get("/accounts/settings"), staleTime: 5 * 60_000, enabled });
}

export function useBankAccounts(query, { enabled = true } = {}) {
  const q = clean(query);
  return useQuery({ queryKey: salesKeys.banks(q), queryFn: () => api.get("/accounts/bank-accounts", { query: q }), staleTime: 60_000, enabled });
}

/** After a booking or receipt write: refresh booking views, the unit grid and the CRM. */
export function useSalesRefresh() {
  const qc = useQueryClient();
  return useCallback(
    ({ bookingId, projectId, unitId, customerId } = {}) => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      if (customerId) qc.invalidateQueries({ queryKey: salesKeys.customer(customerId) });
      if (projectId) {
        qc.invalidateQueries({ queryKey: ["project-units", projectId] });
        qc.invalidateQueries({ queryKey: ["project", projectId] });
      }
      if (unitId) qc.invalidateQueries({ queryKey: ["unit", unitId] });
      if (bookingId) qc.invalidateQueries({ queryKey: salesKeys.ledger(bookingId) });
      qc.invalidateQueries({ queryKey: ["cheques"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    [qc],
  );
}

/** Cheque / PDC register (cursor, newest first). */
export function useCheques(query, { enabled = true } = {}) {
  const q = clean(query);
  return useInfiniteQuery({
    queryKey: salesKeys.cheques(q),
    queryFn: ({ pageParam }) => apiRequest("/cheques", { query: { ...q, limit: 50, cursor: pageParam } }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
    enabled,
  });
}

/** A booking's documents, newest first (the API back-fills missing ones). */
export function useDocuments(bookingId, { enabled = true } = {}) {
  return useQuery({ queryKey: salesKeys.documents(bookingId), queryFn: () => api.get(`/bookings/${bookingId}/documents`), enabled: Boolean(bookingId) && enabled });
}

export function useDocument(id) {
  return useQuery({ queryKey: salesKeys.document(id), queryFn: () => api.get(`/documents/${id}`), enabled: Boolean(id) });
}

/** Reports: kind = dues | collections | pdcs. */
export function useReport(kind, query, { enabled = true } = {}) {
  const q = clean(query);
  return useQuery({ queryKey: salesKeys.report(kind, q), queryFn: () => api.get(`/reports/${kind}`, { query: q }), placeholderData: keepPreviousData, enabled });
}
