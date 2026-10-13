"use client";

import { useState } from "react";
import { Check, Columns3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { toggleCompare, useCompareList } from "@/lib/public/compare";

/** "Add to compare" for a unit page; the pick shows up in the tray at the bottom of every page. */
export function CompareToggle({ id, label, project, className }) {
  const t = useTranslations("site.compare");
  const list = useCompareList();
  const [full, setFull] = useState(false);
  const added = list.some((u) => u.id === id);

  return (
    <div className={className}>
      <button
        type="button"
        aria-pressed={added}
        onClick={() => setFull(toggleCompare({ id, label, project }) === "full")}
        className={cn(
          "inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors",
          added ? "border-accent bg-accent-soft text-ink" : "border-line-strong/40 bg-surface hover:bg-surface-2",
        )}
      >
        {added ? <Check aria-hidden className="size-4 text-accent" /> : <Columns3 aria-hidden className="size-4" strokeWidth={1.5} />}
        {added ? t("added") : t("add")}
      </button>
      {full && !added && (
        <p role="status" className="mt-2 text-xs text-ink-muted">
          {t("full")}
        </p>
      )}
    </div>
  );
}
