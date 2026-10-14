/**
 * Pure helpers for the accounts UI (integer poisha, Dhaka calendar dates). Mirrors the backend
 * rules where the UI needs a preview before saving — the server stays the source of truth.
 */

const OFFSET_MS = 6 * 3_600_000;

/** Today in Dhaka as 'YYYY-MM-DD'. */
export function todayDhaka(now = new Date()) {
  return new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(s, days) {
  return new Date(Date.parse(`${s}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** basis points → "12.5" (no % sign). */
export const bpsToPct = (bps) => (bps == null ? "" : String(Number(bps) / 100));

/** "12.5" → 1250 (null when invalid / more than 2 decimals). */
export function pctToBps(input) {
  const s = String(input ?? "").trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const [w, f = ""] = s.split(".");
  return Number(w) * 100 + Number(f.padEnd(2, "0"));
}

/** bps of an amount, rounded half away from zero (BigInt: large contracts pass 2^53). */
export function bpsOf(amount, bps) {
  const abs = BigInt(Math.abs(amount)) * BigInt(bps);
  const q = abs / 10_000n;
  return Math.sign(amount) * Number(abs % 10_000n >= 5_000n ? q + 1n : q);
}

const remainingOf = (i) => Math.max(0, (i.amount ?? 0) - (i.paid ?? 0));
const time = (d) => (d ? Date.parse(`${d}T00:00:00Z`) : null);

/** Allocation order = backend allocation.js: dated items by due date (seq breaks ties), then undated by seq. */
export function allocationOrder(items) {
  return [...items].sort((a, b) => {
    const ta = time(a.dueDate);
    const tb = time(b.dueDate);
    if (ta !== null && tb !== null && ta !== tb) return ta - tb;
    if ((ta === null) !== (tb === null)) return ta === null ? 1 : -1;
    return a.seq - b.seq;
  });
}

export const outstandingOf = (items) => items.reduce((s, i) => s + remainingOf(i), 0);

/** Preview of how a receipt will be split: [{ item, amount, settles }] — empty if amount ≤ 0. */
export function previewAllocation(items, amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0) return [];
  let left = amount;
  const out = [];
  for (const item of allocationOrder(items)) {
    if (!left) break;
    const rem = remainingOf(item);
    const take = Math.min(rem, left);
    if (!take) continue;
    out.push({ item, amount: take, settles: take === rem });
    left -= take;
  }
  return out;
}

const wholeTaka = (p) => Math.floor(p / 100) * 100;
const partAmount = (contract, part) => (part.type === "fixed" ? part.value : wholeTaka(bpsOf(contract, part.value)));

/**
 * Amounts a plan template gives on a sample contract (dates left out) — the plan editor's
 * illustration. Same rounding as the backend generator; returns { rows, error }.
 */
export function samplePlan(spec, contract) {
  const rows = [];
  try {
    rows.push({ code: "booking_money", amount: partAmount(contract, spec.bookingMoney) });
    if (spec.downPayment) rows.push({ code: "down_payment", amount: partAmount(contract, spec.downPayment), days: spec.downPayment.dueAfterDays ?? 0 });
    for (const m of spec.milestones ?? []) rows.push({ code: "milestone", label: m.label, labelBn: m.labelBn, amount: partAmount(contract, m) });
    const handover = spec.handover && spec.handover.type !== "balance" ? partAmount(contract, spec.handover) : null;
    const fixed = rows.reduce((s, r) => s + r.amount, 0) + (handover ?? 0);
    const balance = contract - fixed;
    const count = spec.installments?.count ?? 0;
    if (count > 0) {
      const each = wholeTaka(Math.floor(balance / count));
      if (balance <= 0 || each <= 0) return { rows, error: "PLAN_EXCEEDS_PRICE" };
      rows.push({ code: "installment", amount: each, count, last: balance - each * (count - 1), every: spec.installments.everyMonths });
      if (handover != null) rows.push({ code: "handover", amount: handover });
    } else {
      if (balance <= 0) return { rows, error: "PLAN_EXCEEDS_PRICE" };
      rows.push({ code: "handover", amount: balance, balance: true });
    }
    return { rows, error: null };
  } catch {
    return { rows, error: "INVALID_PLAN" };
  }
}

/** A fresh Idempotency-Key (UUID, falls back to random hex on old browsers). */
export function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}
