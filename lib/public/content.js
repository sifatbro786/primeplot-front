/**
 * Site content text (B2b — contract: API.md › B2b › Conventions). Text from the dashboard is
 * plain: `{company}` → the company's name, `*words*` → emphasis, a blank line → new paragraph.
 * It is rendered as React text nodes only — never as HTML.
 */

/** Bilingual `{ en, bn }` → the visitor's language, falling back to the other one. */
export function tx(t, locale) {
  if (!t) return "";
  return (locale === "bn" ? t.bn || t.en : t.en || t.bn) || "";
}

/** `tx` + `{company}` replaced. */
export function makeText(locale, company) {
  return (t) => tx(t, locale).replaceAll("{company}", company || "");
}

/** Plain string for metadata / alt text: emphasis markers removed. */
export const plain = (s) => String(s ?? "").replace(/\*([^*\n]+)\*/g, "$1");

/** "A home, *seen clearly*" → ["A home, ", <em>seen clearly</em>]. */
export function Emph({ text, emClassName = "italic text-accent" }) {
  const parts = String(text ?? "").split(/\*([^*\n]+)\*/g);
  return parts.map((p, i) =>
    i % 2 ? (
      <em key={i} className={emClassName}>
        {p}
      </em>
    ) : (
      p
    ),
  );
}

/** Blank line → paragraph, single newline → line break. */
export function Paragraphs({ text, className, pClassName }) {
  const paras = String(text ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!paras.length) return null;
  return (
    <div className={className}>
      {paras.map((p, i) => (
        <p key={i} className={pClassName}>
          {p.split("\n").map((line, j) => (
            <span key={j}>
              {j > 0 && <br />}
              {line}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

/** Sections of a page by key (only the visible ones are sent by the API). */
export const sectionMap = (page) => new Map((page?.sections ?? []).map((s) => [s.key, s]));
