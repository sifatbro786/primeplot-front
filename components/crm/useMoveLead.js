"use client";

import { useTranslations } from "next-intl";
import { toast } from "@/components/ui/Toast";
import { api } from "@/lib/api/client";
import { isStale, useCrmError } from "@/lib/crm/errors";
import { useCrmRefresh } from "@/lib/crm/queries";
import { useLostReason } from "./LostReasonDialog";

/**
 * Move a lead to a stage (Kanban drop, "Move to…" menu, drawer stage picker).
 * Asks for a reason first when the target is a lost stage. Returns the updated lead, or null
 * when cancelled / refused (the error is shown and every lead view is refreshed).
 * Render `dialog` once in the component that uses it.
 */
export function useMoveLead() {
  const t = useTranslations("crm");
  const refresh = useCrmRefresh();
  const crmError = useCrmError();
  const lost = useLostReason();

  const move = async (lead, stage, { afterId, beforeId, onOptimistic, onRevert } = {}) => {
    let extra = {};
    if (stage.kind === "lost") {
      const r = await lost.ask(lead, stage);
      if (!r) return null;
      extra = r;
    }
    onOptimistic?.();
    try {
      const updated = await api.post(`/leads/${lead.id}/move`, {
        version: lead.version,
        stageId: stage.id,
        ...(afterId && { afterId }),
        ...(beforeId && { beforeId }),
        ...extra,
      });
      if (stage.kind === "won") toast.success(t("movedWon", { name: lead.name }));
      refresh(lead.id);
      return updated;
    } catch (err) {
      onRevert?.();
      toast.error(isStale(err) ? t("errors.STALE_BOARD") : crmError(err));
      refresh(lead.id);
      return null;
    }
  };

  return { move, dialog: lost.dialog };
}
