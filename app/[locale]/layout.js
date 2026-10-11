import { Geist_Mono, Hind_Siliguri, Noto_Serif_Bengali, Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { locale as rootLocale } from "next/root-params";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Providers } from "@/components/providers/Providers";
import "../globals.css";

// UI + body (Latin). Variable font → one file for every weight.
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin", "latin-ext"], display: "swap" });
// Display serif (Latin) — only used at ≥28px.
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], display: "swap" });
// Bangla UI/body. Static font: load only the weights we use.
const hind = Hind_Siliguri({
  variable: "--font-hind",
  subsets: ["bengali"],
  weight: ["400", "500", "600"],
  display: "swap",
});
// Bangla display serif — pairs with Playfair so BN headlines keep the same character.
const serifBn = Noto_Serif_Bengali({ variable: "--font-serif-bn", subsets: ["bengali"], display: "swap" });
// Unit codes, receipt numbers, money columns.
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata() {
  const t = await getTranslations("meta");
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
    title: { default: t("title"), template: `%s · ${t("title")}` },
    description: t("description"),
  };
}

export const viewport = { themeColor: "#f9f8f6" };

export default async function LocaleLayout({ children }) {
  const locale = await rootLocale();
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html
      lang={locale}
      className={`${jakarta.variable} ${playfair.variable} ${hind.variable} ${serifBn.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas text-ink" suppressHydrationWarning>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
