"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api, apiRequest } from "@/lib/api/client";

/** Website content & SEO (contract: API.md › B2b). */
export const siteKeys = {
  pages: ["site", "pages"],
  page: (key) => ["site", "page", key],
  revisions: (key) => ["site", "revisions", key],
  settings: ["site", "settings"],
  updates: (projectId) => ["construction", projectId],
};

export const usePages = () => useQuery({ queryKey: siteKeys.pages, queryFn: () => api.get("/site/pages") });

export const usePage = (key) => useQuery({ queryKey: siteKeys.page(key), queryFn: () => api.get(`/site/pages/${key}`), enabled: Boolean(key) });

export const useRevisions = (key, { enabled = true } = {}) =>
  useQuery({ queryKey: siteKeys.revisions(key), queryFn: () => api.get(`/site/pages/${key}/revisions`), enabled });

export const useSiteSettings = () => useQuery({ queryKey: siteKeys.settings, queryFn: () => api.get("/site/settings") });

export function useProjectUpdates(projectId) {
  return useInfiniteQuery({
    queryKey: siteKeys.updates(projectId),
    queryFn: ({ pageParam }) => apiRequest(`/projects/${projectId}/updates`, { query: { limit: 20, cursor: pageParam } }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.meta?.nextCursor ?? undefined,
    enabled: Boolean(projectId),
  });
}
