/**
 * CSV for reports: UTF-8 with BOM (Excel opens Bangla correctly), CRLF, quoted cells; a cell
 * starting with = + - @ is prefixed with ' so a spreadsheet never runs it as a formula.
 */
const cell = (v) => {
  if (v == null) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** columns: [{ label, value: (row) => any }] */
export function toCsv(rows, columns) {
  const lines = [columns.map((c) => cell(c.label)).join(",")];
  for (const r of rows) lines.push(columns.map((c) => cell(c.value(r))).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function downloadCsv(name, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/** Poisha → plain taka number for spreadsheets ("125000.5"). */
export const takaCell = (poisha) => (poisha == null ? "" : (poisha / 100).toFixed(2));
