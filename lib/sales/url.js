"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";

/** Read + patch the URL's search params (null/"" removes) without scrolling or a history entry. */
export function useSearchState() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const write = useCallback(
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
  return [params, write];
}
