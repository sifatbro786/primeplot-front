"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { CustomerCard, CustomerPicker } from "../CustomerPicker";
import { NomineesEditor } from "./NomineesEditor";

/** Applicant (required), up to 2 co-applicants, optional nominees (shares = 100 %). */
export function StepBuyer({ draft, patch, lead, errors }) {
  const t = useTranslations("sales.wizard.buyer");
  const tv = useTranslations("sales.validation");
  const [addingCo, setAddingCo] = useState(false);
  const chosen = [draft.customer?.id, ...draft.coApplicants.map((c) => c.id)].filter(Boolean);
  const preset = lead ? { name: lead.name, phone: lead.phone, email: lead.email ?? "", leadId: lead.id } : undefined;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">{t("applicant")}</h3>
        {draft.customer ? (
          <CustomerCard customer={draft.customer} onClear={() => patch({ customer: null })} />
        ) : (
          <>
            {lead && <p className="text-xs text-ink-muted">{t("fromLead", { name: lead.name })}</p>}
            <CustomerPicker onPick={(c) => patch({ customer: c })} exclude={chosen} preset={preset} initialQuery={lead?.phone?.replace(/^\+880/, "0") ?? ""} autoFocus />
          </>
        )}
        {errors.customer && <p className="text-xs font-medium text-danger" role="alert">{tv(errors.customer)}</p>}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">{t("coApplicants")}</h3>
          <p className="text-xs text-ink-muted">{t("coApplicantsHint")}</p>
        </div>
        {draft.coApplicants.map((c) => (
          <CustomerCard key={c.id} customer={c} onClear={() => patch({ coApplicants: draft.coApplicants.filter((x) => x.id !== c.id) })} />
        ))}
        {addingCo ? (
          <CustomerPicker
            exclude={chosen}
            onPick={(c) => {
              patch({ coApplicants: [...draft.coApplicants, c] });
              setAddingCo(false);
            }}
          />
        ) : (
          draft.coApplicants.length < 2 && (
            <Button size="sm" variant="secondary" onClick={() => setAddingCo(true)} disabled={!draft.customer}>
              <Plus aria-hidden className="size-3.5" />
              {t("addCo")}
            </Button>
          )
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">{t("nominees")}</h3>
          <p className="text-xs text-ink-muted">{t("nomineesHint")}</p>
        </div>
        <NomineesEditor value={draft.nominees} onChange={(nominees) => patch({ nominees })} errors={errors.nominees ?? {}} />
      </section>
    </div>
  );
}
