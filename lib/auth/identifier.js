/**
 * Sign-in identifier (B5): an e-mail address or a mobile number in any common form —
 * 01712345678, 01712-345678, +8801712345678, Bangla digits, or a foreign +44… number.
 * Only a shape check; the API normalises and decides.
 */
const BN = "০১২৩৪৫৬৭৮৯";
const toLatin = (s) => s.replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));

export function isPhone(value) {
  const s = toLatin(String(value ?? "").trim()).replace(/[\s()-]/g, "");
  return /^\+?\d{8,15}$/.test(s);
}

export function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());
}

export const isIdentifier = (value) => isEmail(value) || isPhone(value);
