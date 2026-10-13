"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { errorMessage } from "@/lib/auth/session";

/** ApiError → message: CRM-specific codes first, then the shared error texts. */
export function useCrmError() {
  const t = useTranslations("crm.errors");
  const te = useTranslations("errors");
  return useCallback((err) => (err?.code && t.has(err.code) ? t(err.code) : errorMessage(te, err)), [t, te]);
}

/** Errors that mean "your screen is out of date" — refresh rather than retry. */
export const isStale = (err) => ["STALE_VERSION", "STALE_POSITION"].includes(err?.code);
