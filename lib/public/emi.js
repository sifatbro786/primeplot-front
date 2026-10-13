/**
 * Payment estimates in integer poisha (৳1 = 100). Rounded UP to whole taka so a buyer never sees
 * a figure lower than what they will actually pay.
 */
const ceilTaka = (poisha) => Math.ceil(poisha / 100) * 100;

/** Developer installment plan: down payment % now, the rest in equal monthly installments. */
export function installmentPlan(price, downPct, months) {
  if (!(price > 0) || !(months > 0)) return null;
  const down = ceilTaka((price * downPct) / 100);
  const rest = Math.max(0, price - down);
  return { down, rest, monthly: ceilTaka(rest / months), months };
}

/** Bank loan on the remainder: standard reducing-balance EMI. rate = yearly %, years = term. */
export function loanEmi(principal, ratePct, years) {
  const n = Math.round(years * 12);
  if (!(principal > 0) || !(n > 0)) return null;
  const r = ratePct / 12 / 100;
  const emi = r === 0 ? principal / n : (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1);
  const monthly = ceilTaka(emi);
  return { monthly, months: n, totalInterest: Math.max(0, monthly * n - principal) };
}
