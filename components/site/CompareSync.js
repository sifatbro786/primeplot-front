"use client";

import { useEffect } from "react";
import { clearCompare, toggleCompare } from "@/lib/public/compare";

/** The compare URL is the source of truth: opening a shared link makes it the visitor's shortlist. */
export function CompareSync({ items }) {
  const key = items.map((i) => i.id).join(",");
  useEffect(() => {
    clearCompare();
    for (const it of items) toggleCompare(it);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync only when the set of ids changes
  }, [key]);
  return null;
}
