"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { useSession } from "@/lib/auth/session";
import { LEAD_TYPES } from "@/lib/crm/constants";
import { clean } from "@/lib/crm/queries";
import { useLeadParam, useUrlFilters } from "@/lib/crm/url";
import { LeadCreateDrawer } from "./LeadCreateDrawer";
import { LeadDrawer } from "./LeadDrawer";
import { LeadFilters } from "./LeadFilters";
import { PipelineBoard } from "./PipelineBoard";

/** /dashboard/pipeline — Kanban per lead type (buyer / landowner). */
export function PipelinePage() {
  const t = useTranslations("crm");
  const tt = useTranslations("crm.types");
  const { can } = useSession();
  const [filters, setFilters] = useUrlFilters();
  const drawer = useLeadParam();
  const [creating, setCreating] = useState(false);
  const type = filters.type === "landowner" ? "landowner" : "buyer";
  const query = clean({ type, assignee: filters.assignee, projectId: filters.projectId, source: filters.source, tag: filters.tag, q: filters.q });

  return (
    <div>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("pipeline.title")}
        description={t("pipeline.description")}
        actions={
          can("leads:write") && (
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden className="size-4" />
              {t("newLead")}
            </Button>
          )
        }
      />
      <div className="mb-4">
        <Segmented
          aria-label={t("filters.type")}
          value={type}
          onChange={(v) => setFilters({ type: v === "buyer" ? null : v })}
          options={LEAD_TYPES.map((x) => ({ value: x, label: tt(`${x}Pipeline`) }))}
        />
      </div>
      <LeadFilters filters={{ ...filters, type }} setFilters={setFilters} mode="board" />
      <PipelineBoard key={type} query={query} onOpen={drawer.open} />
      <LeadDrawer leadId={drawer.leadId} onClose={drawer.close} onOpenLead={drawer.open} />
      {can("leads:write") && (
        <LeadCreateDrawer open={creating} defaultType={type} onClose={() => setCreating(false)} onCreated={(l) => drawer.open(l.id)} onOpenLead={drawer.open} />
      )}
    </div>
  );
}
