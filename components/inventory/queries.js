"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiRequest } from "@/lib/api/client";
import { useProjectLive } from "@/lib/socket";

/** Query keys + fetchers for B2 inventory (contract: API.md › B2). */
export const keys = {
  projects: (q) => ["projects", q ?? {}],
  project: (id) => ["project", id],
  units: (projectId, blockId) => ["project-units", projectId, blockId ?? "all"],
  unit: (id) => ["unit", id],
};

export function useProject(id) {
  return useQuery({ queryKey: keys.project(id), queryFn: () => api.get(`/projects/${id}`), enabled: Boolean(id) });
}

/** Every unit of a block (the grid loads a whole building at once — limit 1000). */
export function useBlockUnits(projectId, blockId) {
  return useQuery({
    queryKey: keys.units(projectId, blockId),
    queryFn: async () => (await apiRequest(`/projects/${projectId}/units`, { query: { blockId, limit: 1000 } })).data,
    enabled: Boolean(projectId && blockId),
  });
}

export function useUnit(id) {
  return useQuery({ queryKey: keys.unit(id), queryFn: () => api.get(`/units/${id}`), enabled: Boolean(id) });
}

/** After any unit write: put the fresh unit in every cached list + refresh counts. */
export function useUnitCache() {
  const qc = useQueryClient();
  return useCallback(
    (unit) => {
      qc.setQueryData(keys.unit(unit.id), (old) => (old ? { ...old, ...unit } : old));
      let found = false;
      qc.setQueriesData({ queryKey: ["project-units", unit.projectId] }, (list) => {
        if (!Array.isArray(list) || !list.some((u) => u.id === unit.id)) return list;
        found = !list.some((u) => u.id === unit.id && u.blockId !== unit.blockId);
        return list.map((u) => (u.id === unit.id ? { ...u, ...unit } : u));
      });
      if (!found) qc.invalidateQueries({ queryKey: ["project-units", unit.projectId] }); // new unit or moved block
      qc.invalidateQueries({ queryKey: keys.project(unit.projectId) });
    },
    [qc],
  );
}

/**
 * Live grid: apply `unit:status` deltas to the cache in place (no refetch per event) and
 * refetch everything after a reconnect. The staff delta has no `hold.by`, so an open unit
 * drawer refetches its own detail.
 */
export function useLiveInventory(projectId) {
  const qc = useQueryClient();
  const onDelta = useCallback(
    (d) => {
      const patch = (u) =>
        u.id === d.unitId
          ? {
              ...u,
              status: d.status,
              listPrice: d.listPrice,
              version: d.version,
              hold: d.hold ? { ...(u.hold ?? {}), byName: d.hold.byName, until: d.hold.until } : null,
            }
          : u;
      qc.setQueriesData({ queryKey: ["project-units", projectId] }, (list) => (Array.isArray(list) ? list.map(patch) : list));
      qc.invalidateQueries({ queryKey: keys.unit(d.unitId) });
      qc.invalidateQueries({ queryKey: keys.project(projectId) });
    },
    [qc, projectId],
  );
  const onResync = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["project-units", projectId] });
    qc.invalidateQueries({ queryKey: keys.project(projectId) });
  }, [qc, projectId]);
  return useProjectLive(projectId, { onDelta, onResync });
}
