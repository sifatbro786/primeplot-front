"use client";

import { useCallback } from "react";
import { keepPreviousData, useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiRequest } from "@/lib/api/client";
import { clean } from "@/lib/sales/queries";

/** Staff side of the customer portal — contract: API.md › B5.1 / B5.2 / B5.3. */
export const reviewKeys = {
  slips: (q) => ["payment-slips", "list", q ?? {}],
  slip: (id) => ["payment-slips", "one", id],
  payments: (q) => ["online-payments", "list", q ?? {}],
  payment: (id) => ["online-payments", "one", id],
  requests: (q) => ["profile-requests", "list", q ?? {}],
  request: (id) => ["profile-requests", "one", id],
  portal: (customerId) => ["customers", "portal", customerId],
};

const cursorList = (key, path) =>
  function useList(query, { enabled = true } = {}) {
    const q = clean(query);
    return useInfiniteQuery({
      queryKey: key(q),
      queryFn: ({ pageParam }) => apiRequest(path, { query: { ...q, limit: 30, cursor: pageParam } }),
      initialPageParam: undefined,
      getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
      enabled,
    });
  };

export const useSlipQueue = cursorList(reviewKeys.slips, "/payment-slips");
export const useOnlinePayments = cursorList(reviewKeys.payments, "/online-payments");
export const useProfileRequestQueue = cursorList(reviewKeys.requests, "/profile-requests");

export function useSlip(id) {
  return useQuery({ queryKey: reviewKeys.slip(id), queryFn: () => api.get(`/payment-slips/${id}`), enabled: Boolean(id) });
}
export function useOnlinePayment(id) {
  return useQuery({ queryKey: reviewKeys.payment(id), queryFn: () => api.get(`/online-payments/${id}`), enabled: Boolean(id) });
}
export function useProfileRequest(id) {
  return useQuery({ queryKey: reviewKeys.request(id), queryFn: () => api.get(`/profile-requests/${id}`), enabled: Boolean(id) });
}
export function useCustomerPortal(customerId, { enabled = true } = {}) {
  return useQuery({ queryKey: reviewKeys.portal(customerId), queryFn: () => api.get(`/customers/${customerId}/portal`), enabled: Boolean(customerId) && enabled, retry: false });
}

/** After a decision: the queue, the booking it touched (receipt) and reports refresh. */
export function useReviewRefresh() {
  const qc = useQueryClient();
  return useCallback(
    (kind) => {
      qc.invalidateQueries({ queryKey: [kind] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
    [qc],
  );
}

// ── Reminders (API.md › B5.3) ────────────────────────────────────────────────────
export const reminderKeys = {
  preview: ["reminders", "preview"],
  log: (q) => ["reminders", "log", q ?? {}],
};

/** What today's run would send — nothing is sent. */
export function useReminderPreview({ enabled = true } = {}) {
  return useQuery({ queryKey: reminderKeys.preview, queryFn: () => api.get("/reminders/preview"), enabled, staleTime: 30_000 });
}

export const useReminderLog = cursorList(reminderKeys.log, "/reminders/log");

// ── Analytics (API.md › B5.3) ────────────────────────────────────────────────────
export function useAnalytics(query) {
  const q = clean(query);
  return useQuery({ queryKey: ["analytics", "overview", q], queryFn: () => api.get("/analytics/overview", { query: q }), placeholderData: keepPreviousData, staleTime: 60_000 });
}
