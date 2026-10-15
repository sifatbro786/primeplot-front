"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import Script from "next/script";
import { Columns3, MessageCircle, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { CONSENT_EVENT, CONSENT_OPEN_EVENT, consentFor, readConsent, setConsent } from "@/lib/analytics/consent";
import { track } from "@/lib/analytics/track";
import { clearCompare, compareHref, removeCompare, useCompareList } from "@/lib/public/compare";
import { localizeDigits } from "@/lib/format";
import { whatsappHref } from "@/lib/public/site";

// Re-checked here: the IDs end up inside inline scripts, so only exact formats are ever used.
const GA4_RE = /^G-[A-Z0-9]{4,15}$/;
const PIXEL_RE = /^\d{8,20}$/;

/* ---------- consent state ("unknown" until mounted, so SSR and hydration agree) ---------- */
let bannerForced = false;
function subscribeConsent(cb) {
  const open = () => {
    bannerForced = true;
    cb();
  };
  const changed = () => {
    bannerForced = false;
    cb();
  };
  window.addEventListener(CONSENT_EVENT, changed);
  window.addEventListener(CONSENT_OPEN_EVENT, open);
  return () => {
    window.removeEventListener(CONSENT_EVENT, changed);
    window.removeEventListener(CONSENT_OPEN_EVENT, open);
  };
}
const consentSnapshot = () => `${readConsent() ?? ""}|${bannerForced ? 1 : 0}`;
/** consent: "unknown" (server/first paint) | "granted" | "denied" | "none" (ask). */
const useConsent = (tools) => {
  const snap = useSyncExternalStore(subscribeConsent, consentSnapshot, () => null);
  if (snap === null) return { consent: "unknown", bannerOpen: false };
  const [raw, forced] = snap.split("|");
  const consent = consentFor(raw || null, tools);
  return { consent, bannerOpen: consent === "none" || forced === "1" };
};

/* ---------- tags ---------- */
function Tags({ ga4Id, pixelId }) {
  const pathname = usePathname();
  const first = useRef(true);

  // GA4 records SPA navigations itself (enhanced measurement › history events); the Pixel doesn't.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.fbq?.("track", "PageView");
  }, [pathname]);

  return (
    <>
      {ga4Id && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`} strategy="afterInteractive" />
          <Script id="pp-ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');`}
          </Script>
        </>
      )}
      {pixelId && (
        <Script id="pp-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixelId}');fbq('track','PageView');`}
        </Script>
      )}
    </>
  );
}

/** Call / WhatsApp clicks anywhere on the site (no-op unless tags are loaded). */
function useContactClickEvents() {
  const pathname = usePathname();
  useEffect(() => {
    const onClick = (e) => {
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!a) return;
      const href = a.getAttribute("href");
      if (href.startsWith("tel:")) track("contact_call", { page: pathname });
      else if (href.startsWith("https://wa.me/")) track("contact_whatsapp", { page: pathname });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);
}

/* ---------- pieces ---------- */
function ConsentBanner({ tools }) {
  const t = useTranslations("site.legal.consent");
  return (
    <section
      role="region"
      aria-label={t("label")}
      className="pointer-events-auto w-full rounded-lg border border-line bg-surface p-5 shadow-[0_18px_40px_-20px_rgb(35_39_31/0.45)] sm:max-w-md"
    >
      <h2 className="font-display text-lg">{t("title")}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">
        {t("body")}{" "}
        <Link href="/privacy" className="text-accent underline underline-offset-2 hover:text-ink">
          {t("more")}
        </Link>
      </p>
      {/* Equal weight on purpose: refusing must be as easy as accepting. */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setConsent("denied", tools)}
          className="h-10 rounded-md border border-line-strong/40 bg-surface px-3 text-sm font-medium hover:bg-surface-2"
        >
          {t("reject")}
        </button>
        <button type="button" onClick={() => setConsent("granted", tools)} className="h-10 rounded-md bg-primary px-3 text-sm font-medium text-primary-ink hover:bg-primary-hover">
          {t("accept")}
        </button>
      </div>
    </section>
  );
}

function CompareTray() {
  const t = useTranslations("site.compare");
  const locale = useLocale();
  const list = useCompareList();
  const pathname = usePathname();
  const n = localizeDigits(list.length, locale);
  if (!list.length || pathname === "/compare") return null;
  return (
    <section aria-label={t("trayLabel")} className="band-dark pointer-events-auto w-full rounded-lg p-3 shadow-[0_18px_40px_-20px_rgb(35_39_31/0.6)] sm:max-w-2xl sm:self-center">
      <div className="flex flex-wrap items-center gap-2">
        <Columns3 aria-hidden className="ml-1 size-4 shrink-0 text-accent-on-dark" strokeWidth={1.5} />
        <p className="flex-1 text-xs sm:hidden">{t("count", { n })}</p>
        <ul className="hidden min-w-0 flex-1 flex-wrap gap-1.5 sm:flex">
          {list.map((u) => (
            <li key={u.id} className="flex items-center gap-1 rounded-md bg-primary-deep py-1 pr-1 pl-2.5 text-xs">
              <span className="truncate font-mono">{u.label}</span>
              <button type="button" onClick={() => removeCompare(u.id)} aria-label={t("remove", { label: u.label })} className="grid size-5 place-items-center rounded hover:bg-primary-ink/10">
                <X aria-hidden className="size-3" />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={clearCompare} className="px-2 text-xs text-primary-ink/65 hover:text-primary-ink hover:underline">
          {t("clear")}
        </button>
        <Link
          href={compareHref(list)}
          aria-disabled={list.length < 2}
          onClick={(e) => list.length < 2 && e.preventDefault()}
          className="inline-flex h-9 items-center rounded-md bg-primary-ink px-3.5 text-xs font-semibold text-primary aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          {list.length < 2 ? t("pickMore") : t("cta", { n })}
        </Link>
      </div>
    </section>
  );
}

function WhatsAppButton({ phone }) {
  const t = useTranslations("site.legal");
  const href = whatsappHref(phone);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("whatsapp")}
      className="pointer-events-auto inline-flex h-14 items-center gap-2.5 rounded-full bg-success px-4 text-primary-ink shadow-[0_12px_28px_-12px_rgb(35_39_31/0.7)] ring-4 ring-paper/90 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:pr-5"
    >
      <MessageCircle aria-hidden className="size-6" strokeWidth={1.75} />
      {/* <span aria-hidden className="hidden text-sm font-semibold sm:inline">
        WhatsApp
      </span> */}
    </a>
  );
}

/**
 * Everything that floats over the public site, stacked bottom-up so nothing overlaps:
 * WhatsApp button · comparison tray · cookie banner. Also loads the tracking tags (consent-gated).
 */
export function SiteDock({ phone, ga4Id, pixelId }) {
  const ga4 = GA4_RE.test(ga4Id ?? "") ? ga4Id : null;
  const pixel = PIXEL_RE.test(pixelId ?? "") ? pixelId : null;
  const tools = `${ga4 ? "g" : ""}${pixel ? "p" : ""}`;
  const hasTags = tools !== "";
  const { consent, bannerOpen } = useConsent(tools);
  useContactClickEvents();
  const showBanner = hasTags && consent !== "unknown" && bannerOpen;

  return (
    <>
      {hasTags && consent === "granted" && <Tags ga4Id={ga4} pixelId={pixel} />}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
        <CompareTray />
        <div className="flex items-end justify-between gap-4">
          {showBanner ? <ConsentBanner tools={tools} /> : <span />}
          {/* On phones the banner is full width, so the button waits until a choice is made. */}
          <div className={showBanner ? "hidden sm:block" : undefined}>
            <WhatsAppButton phone={phone} />
          </div>
        </div>
      </div>
    </>
  );
}
