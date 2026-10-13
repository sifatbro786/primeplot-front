"use client";

import { useCallback } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiRequest } from "@/lib/api/client";

/** Query keys + fetchers for the CRM (contract: API.md › B3 / B3.2). */
export const crmKeys = {
  all: ["leads"],
  list: (q) => ["leads", "list", q ?? {}],
  board: (q) => ["leads", "board", q ?? {}],
  lead: (id) => ["leads", "one", id],
  activities: (id) => ["leads", "activities", id],
  leadTasks: (id) => ["leads", "tasks", id],
  assignees: ["leads", "assignees"],
  stages: (type) => ["lead-stages", type],
  settings: ["lead-settings"],
  tasks: (q) => ["tasks", q ?? {}],
  taskCounts: ["tasks", "counts"],
  notifications: ["notifications", "list"],
  unread: ["notifications", "unread"],
  projectsLite: ["projects", "lite"],
  integrations: ["integrations"],
};

/** Drop empty values so query keys and URLs stay stable. */
export function clean(q) {
  return Object.fromEntries(Object.entries(q ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== ""));
}

/** Cursor-paginated lead list (newest first). */
export function useLeadList(query, { enabled = true } = {}) {
  const q = clean(query);
  return useInfiniteQuery({
    queryKey: crmKeys.list(q),
    queryFn: ({ pageParam }) => apiRequest("/leads", { query: { ...q, limit: 50, cursor: pageParam } }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
    enabled,
  });
}

export function useBoard(query) {
  const q = clean(query);
  return useQuery({ queryKey: crmKeys.board(q), queryFn: () => api.get("/leads/board", { query: q }) });
}

export function useLead(id) {
  return useQuery({ queryKey: crmKeys.lead(id), queryFn: () => api.get(`/leads/${id}`), enabled: Boolean(id) });
}

export function useActivities(leadId) {
  return useInfiniteQuery({
    queryKey: crmKeys.activities(leadId),
    queryFn: ({ pageParam }) => apiRequest(`/leads/${leadId}/activities`, { query: { limit: 30, cursor: pageParam } }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
    enabled: Boolean(leadId),
  });
}

/** A lead's tasks by status (the API lists one status at a time; default open). */
export function useLeadTasks(leadId, status = "open", { enabled = true } = {}) {
  return useQuery({
    queryKey: [...crmKeys.leadTasks(leadId), status],
    queryFn: async () => (await apiRequest(`/leads/${leadId}/tasks`, { query: { status, limit: 100 } })).data,
    enabled: Boolean(leadId) && enabled,
  });
}

export function useStages(type) {
  return useQuery({ queryKey: crmKeys.stages(type), queryFn: () => api.get("/leads/stages", { query: { type } }), staleTime: 5 * 60_000 });
}

export function useAssignees({ enabled = true } = {}) {
  return useQuery({ queryKey: crmKeys.assignees, queryFn: () => api.get("/leads/assignees"), staleTime: 5 * 60_000, enabled });
}

/** Projects for pickers (name only). Executives can read projects too. */
export function useProjectOptions({ enabled = true } = {}) {
  return useQuery({
    queryKey: crmKeys.projectsLite,
    queryFn: async () => (await apiRequest("/projects", { query: { limit: 100 } })).data,
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useTaskCounts({ enabled = true } = {}) {
  return useQuery({ queryKey: crmKeys.taskCounts, queryFn: () => api.get("/leads/tasks/counts"), staleTime: 60_000, enabled });
}

export function useTaskList(query) {
  const q = clean(query);
  return useInfiniteQuery({
    queryKey: crmKeys.tasks(q),
    queryFn: ({ pageParam }) => apiRequest("/leads/tasks", { query: { ...q, limit: 50, cursor: pageParam } }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
  });
}

export function useLeadSettings({ enabled = true } = {}) {
  return useQuery({ queryKey: crmKeys.settings, queryFn: () => api.get("/leads/settings"), enabled });
}

/** After any lead write: refresh every lead view (list, board, detail, timeline, tasks). */
export function useCrmRefresh() {
  const qc = useQueryClient();
  return useCallback(
    (leadId) => {
      qc.invalidateQueries({ queryKey: crmKeys.all });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      if (leadId) qc.invalidateQueries({ queryKey: crmKeys.lead(leadId) });
    },
    [qc],
  );
}

/** Flatten an infinite query's pages into one array. */
export const flatPages = (data) => data?.pages?.flatMap((p) => p.data ?? []) ?? [];
