"use client";

import { emptyPayment } from "../PaymentFields";
import { newIdempotencyKey, todayDhaka } from "@/lib/sales/money";

/**
 * Booking wizard state. Kept in sessionStorage (this tab only) so a reload or an accidental
 * navigation does not lose a half-entered booking; cleared after the booking is saved.
 */
const KEY = "pp:booking-draft:v1";

export function newDraft(init = {}) {
  return {
    key: newIdempotencyKey(), // one Idempotency-Key per booking attempt (retries replay it)
    step: 0,
    projectId: init.projectId ?? "",
    unitId: init.unitId ?? "",
    leadId: init.leadId ?? "",
    customer: null,
    coApplicants: [],
    nominees: [],
    planMode: "template",
    planId: "",
    schedule: [],
    bookingDate: todayDhaka(),
    discountAmount: "",
    discountReason: "",
    payMode: "pay",
    payment: emptyPayment(),
    waiveReason: "",
    note: "",
    savedAt: Date.now(),
  };
}

export function loadDraft() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && typeof d === "object" && d.key ? d : null;
  } catch {
    return null;
  }
}

export function saveDraft(d) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...d, savedAt: Date.now() }));
  } catch {
    // Private mode / storage full: the wizard still works, only without the safety net.
  }
}

export function clearDraft() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Is a restored draft worth offering (anything chosen beyond the defaults)? */
export const hasProgress = (d) => Boolean(d && (d.unitId || d.customer));
