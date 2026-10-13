"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { LOST_REASONS } from "@/lib/crm/constants";

/**
 * Moving a lead into a "lost" column needs a reason (API: LOST_REASON_REQUIRED).
 * `state` = null | { lead, stage, resolve(result|null) } — resolve(null) on cancel.
 */
export function LostReasonDialog({ state, onDone }) {
  const t = useTranslations("crm.lost");
  const tr = useTranslations("crm.lostReasons");
  const tc = useTranslations("common");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const finish = (value) => {
    onDone(value);
    setReason("");
    setNote("");
  };

  return (
    <Dialog
      open={Boolean(state)}
      onClose={() => finish(null)}
      title={t("title")}
      description={state ? t("description", { name: state.lead.name }) : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={() => finish(null)}>
            {tc("cancel")}
          </Button>
          <Button variant="danger" disabled={!reason} onClick={() => finish({ lostReason: reason, lostNote: note.trim() || undefined })}>
            {t("confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t("reason")} required>
          <Select value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("pick")} required>
            {LOST_REASONS.map((r) => (
              <option key={r} value={r}>
                {tr(r)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("note")} optionalLabel={tc("optional")}>
          <Textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

/** Hook: `ask(lead, stage)` → Promise<{ lostReason, lostNote } | null>. */
export function useLostReason() {
  const [state, setState] = useState(null);
  const ask = (lead, stage) => new Promise((resolve) => setState({ lead, stage, resolve }));
  const dialog = (
    <LostReasonDialog
      state={state}
      onDone={(v) => {
        state?.resolve(v);
        setState(null);
      }}
    />
  );
  return { ask, dialog };
}
