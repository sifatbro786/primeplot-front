"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { readFilters } from "./constants";

/** Replace some search params (null/"" removes) without scrolling or a history entry. */
function useParamWriter() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(
    (patch) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === null || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, router, pathname],
  );
}

/** Lead filters live in the URL (shareable, survive reload). */
export function useUrlFilters() {
  const params = useSearchParams();
  const write = useParamWriter();
  return [readFilters(params), write];
}

/** The open lead drawer is `?lead=<id>` on any CRM page. */
export function useLeadParam() {
  const params = useSearchParams();
  const write = useParamWriter();
  return {
    leadId: params.get("lead"),
    open: useCallback((id) => write({ lead: id }), [write]),
    close: useCallback(() => write({ lead: null }), [write]),
  };
}
