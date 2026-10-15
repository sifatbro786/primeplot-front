"use client";

import { useCallback } from "react";
import { useInfiniteQuery, useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { api, apiRequest } from "@/lib/api/client";

/** Customer portal (client logins) — contract: API.md › B5.1 / B5.2. */
export const portalKeys = {
  me: ["portal", "me"],
  bookings: ["portal", "bookings"],
  booking: (id) => ["portal", "booking", id],
  dues: (days) => ["portal", "dues", days],
  slips: (q) => ["portal", "slips", q ?? {}],
  payments: ["portal", "payments"],
  payment: (id) => ["portal", "payment", id],
  requests: ["portal", "profile-requests"],
};

export function usePortalMe() {
  return useQuery({ queryKey: portalKeys.me, queryFn: () => api.get("/portal/me"), staleTime: 60_000 });
}

export function usePortalBookings() {
  return useQuery({ queryKey: portalKeys.bookings, queryFn: () => api.get("/portal/bookings"), staleTime: 30_000 });
}

export function usePortalBooking(id) {
  return useQuery({ queryKey: portalKeys.booking(id), queryFn: () => api.get(`/portal/bookings/${id}`), enabled: Boolean(id) });
}

/** Every booking's detail (documents page): a client has a handful of bookings at most. */
export function usePortalBookingDetails(ids) {
  return useQueries({
    queries: (ids ?? []).map((id) => ({ queryKey: portalKeys.booking(id), queryFn: () => api.get(`/portal/bookings/${id}`) })),
  });
}

export function usePortalDues(days = 60) {
  return useQuery({ queryKey: portalKeys.dues(days), queryFn: () => api.get("/portal/dues", { query: { days } }), staleTime: 30_000 });
}

/** Own slips, newest first (cursor). */
export function usePortalSlips(query) {
  const q = Object.fromEntries(Object.entries(query ?? {}).filter(([, v]) => v));
  return useInfiniteQuery({
    queryKey: portalKeys.slips(q),
    queryFn: ({ pageParam }) => apiRequest("/portal/slips", { query: { ...q, limit: 20, cursor: pageParam } }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
  });
}

export function usePortalPayments() {
  return useInfiniteQuery({
    queryKey: portalKeys.payments,
    queryFn: ({ pageParam }) => apiRequest("/portal/payments", { query: { limit: 20, cursor: pageParam } }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
  });
}

/**
 * One online payment. While it is `initiated` (the gateway's server call may land a few seconds
 * after the browser comes back) poll every 3 s, then stop; give up polling after ~2 minutes —
 * the reconcile job settles anything later and the page says so.
 */
export function usePortalPayment(id) {
  return useQuery({
    queryKey: portalKeys.payment(id),
    queryFn: () => api.get(`/portal/payments/${id}`),
    enabled: Boolean(id),
    refetchInterval: (q) => (q.state.data?.status === "initiated" && q.state.dataUpdateCount < 40 ? 3000 : false),
  });
}

export function useProfileRequests() {
  return useQuery({ queryKey: portalKeys.requests, queryFn: () => api.get("/portal/profile-requests") });
}

/** After a slip / payment / request write: everything money- or profile-shaped refreshes. */
export function usePortalRefresh() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: ["portal"] }), [qc]);
}

export const docPdfUrl = (id, locale, download) => `/api/v1/portal/documents/${id}/pdf?locale=${locale}${download ? "&download=1" : ""}`;
export const docHtmlUrl = (id, locale) => `/api/v1/portal/documents/${id}/html?locale=${locale}`;
