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
  floorplans: (projectId) => ["floorplans", projectId],
  floorplan: (id, floor) => ["floorplan", id, floor ?? "default"],
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

/** Every unit of the project across blocks (plan editor pickers; ≤ 1000). */
export function useAllUnits(projectId, { enabled = true } = {}) {
  return useQuery({
    queryKey: keys.units(projectId),
    queryFn: async () => (await apiRequest(`/projects/${projectId}/units`, { query: { limit: 1000 } })).data,
    enabled: Boolean(projectId) && enabled,
  });
}

export function useFloorPlans(projectId) {
  return useQuery({ queryKey: keys.floorplans(projectId), queryFn: () => api.get(`/projects/${projectId}/floorplans`), enabled: Boolean(projectId) });
}

/** One plan resolved for a floor (typical plans cover many floors; null = the plan's first). */
export function useFloorPlan(id, floor) {
  return useQuery({
    queryKey: keys.floorplan(id, floor),
    queryFn: () => api.get(`/floorplans/${id}`, { query: { floor: floor ?? undefined } }),
    enabled: Boolean(id),
    placeholderData: (prev) => (prev?.id === id ? prev : undefined), // keep the image while switching floors
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
      qc.invalidateQueries({ queryKey: ["floorplan"] }); // a plan may show this unit (code, price)
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
      // Plan viewer: recolour the hotspot that shows this unit (no refetch).
      qc.setQueriesData({ queryKey: ["floorplan"] }, (plan) => {
        if (plan?.projectId !== projectId || !plan.hotspots?.some((h) => h.target?.unit?.id === d.unitId)) return plan;
        return { ...plan, hotspots: plan.hotspots.map((h) => (h.target?.unit?.id === d.unitId ? { ...h, target: { ...h.target, unit: patch(h.target.unit) } } : h)) };
      });
      qc.invalidateQueries({ queryKey: keys.unit(d.unitId) });
      qc.invalidateQueries({ queryKey: keys.project(projectId) });
    },
    [qc, projectId],
  );
  const onResync = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["project-units", projectId] });
    qc.invalidateQueries({ queryKey: ["floorplan"] });
    qc.invalidateQueries({ queryKey: keys.project(projectId) });
  }, [qc, projectId]);
  return useProjectLive(projectId, { onDelta, onResync });
}
