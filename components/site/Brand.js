import { cn } from "@/lib/cn";
import { pick } from "@/lib/public/site";

/**
 * The developer's mark: uploaded logo when there is one (public WebP), otherwise the name set in
 * letter-spaced capitals (Latin) or the Bangla display face. `org` may be null (API down) →
 * `fallback` text.
 */
export function Brand({ org, locale, fallback, inverted = false, className }) {
  const name = pick(org, "name", locale) || fallback;
  const logo = org?.logo?.urls?.thumb ?? org?.logo?.urls?.card;
  const isBn = /[ঀ-৿]/.test(name);
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element -- already a resized WebP variant
        <img src={logo} alt="" width={32} height={32} className="size-8 shrink-0 rounded-sm object-contain" />
      )}
      <span
        className={cn(
          "truncate",
          isBn ? "font-display text-lg leading-none" : "text-[12px] font-semibold tracking-[0.2em] uppercase sm:text-[13px] sm:tracking-[0.28em]",
          inverted ? "text-primary-ink" : "text-ink",
        )}
      >
        {name}
      </span>
    </span>
  );
}
