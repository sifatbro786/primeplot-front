/**
 * Amount in words (BN/EN, lakh–crore) — mirrors the backend's shared/utils/money.js so a typo
 * in a money field is caught before saving (the receipt prints the server's own text).
 * Integer poisha in, display string out.
 */

const EN_ONES = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const EN_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function en99(n) {
  if (n < 20) return EN_ONES[n];
  const t = EN_TENS[Math.floor(n / 10)];
  return n % 10 ? `${t}-${EN_ONES[n % 10]}` : t;
}

function en999(n) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const parts = [];
  if (h) parts.push(`${EN_ONES[h]} Hundred`);
  if (r) parts.push(en99(r));
  return parts.join(" ");
}

function enWords(n) {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;
  const parts = [];
  if (crore) parts.push(`${enWords(crore)} Crore`);
  if (lakh) parts.push(`${en99(lakh)} Lakh`);
  if (thousand) parts.push(`${en99(thousand)} Thousand`);
  if (rest) parts.push(en999(rest));
  return parts.join(" ");
}

const BN_0_99 = [
  "শূন্য", "এক", "দুই", "তিন", "চার", "পাঁচ", "ছয়", "সাত", "আট", "নয়",
  "দশ", "এগারো", "বারো", "তেরো", "চৌদ্দ", "পনেরো", "ষোলো", "সতেরো", "আঠারো", "উনিশ",
  "বিশ", "একুশ", "বাইশ", "তেইশ", "চব্বিশ", "পঁচিশ", "ছাব্বিশ", "সাতাশ", "আটাশ", "ঊনত্রিশ",
  "ত্রিশ", "একত্রিশ", "বত্রিশ", "তেত্রিশ", "চৌত্রিশ", "পঁয়ত্রিশ", "ছত্রিশ", "সাঁইত্রিশ", "আটত্রিশ", "ঊনচল্লিশ",
  "চল্লিশ", "একচল্লিশ", "বিয়াল্লিশ", "তেতাল্লিশ", "চুয়াল্লিশ", "পঁয়তাল্লিশ", "ছেচল্লিশ", "সাতচল্লিশ", "আটচল্লিশ", "ঊনপঞ্চাশ",
  "পঞ্চাশ", "একান্ন", "বাহান্ন", "তিপ্পান্ন", "চুয়ান্ন", "পঞ্চান্ন", "ছাপ্পান্ন", "সাতান্ন", "আটান্ন", "ঊনষাট",
  "ষাট", "একষট্টি", "বাষট্টি", "তেষট্টি", "চৌষট্টি", "পঁয়ষট্টি", "ছেষট্টি", "সাতষট্টি", "আটষট্টি", "ঊনসত্তর",
  "সত্তর", "একাত্তর", "বাহাত্তর", "তিয়াত্তর", "চুয়াত্তর", "পঁচাত্তর", "ছিয়াত্তর", "সাতাত্তর", "আটাত্তর", "ঊনআশি",
  "আশি", "একাশি", "বিরাশি", "তিরাশি", "চুরাশি", "পঁচাশি", "ছিয়াশি", "সাতাশি", "আটাশি", "ঊননব্বই",
  "নব্বই", "একানব্বই", "বিরানব্বই", "তিরানব্বই", "চুরানব্বই", "পঁচানব্বই", "ছিয়ানব্বই", "সাতানব্বই", "আটানব্বই", "নিরানব্বই",
];

function bnWords(n) {
  if (n === 0) return BN_0_99[0];
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const hundred = Math.floor((n % 1000) / 100);
  const rest = n % 100;
  const parts = [];
  if (crore) parts.push(`${bnWords(crore)} কোটি`);
  if (lakh) parts.push(`${BN_0_99[lakh]} লক্ষ`);
  if (thousand) parts.push(`${BN_0_99[thousand]} হাজার`);
  if (hundred) parts.push(`${BN_0_99[hundred]} শত`);
  if (rest) parts.push(BN_0_99[rest]);
  return parts.join(" ");
}

/** 50000000 → "Five Lakh Taka Only" / "পাঁচ লক্ষ টাকা মাত্র"; null for anything but a non-negative integer. */
export function amountInWords(poisha, locale = "en") {
  if (!Number.isSafeInteger(poisha) || poisha < 0) return null;
  const taka = Math.floor(poisha / 100);
  const ps = poisha % 100;
  if (locale === "bn") {
    const t = `${bnWords(taka)} টাকা`;
    return ps ? `${t} ${BN_0_99[ps]} পয়সা মাত্র` : `${t} মাত্র`;
  }
  const t = `${enWords(taka)} Taka`;
  return ps ? `${t} and ${en99(ps)} Poisha Only` : `${t} Only`;
}
