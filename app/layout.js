import { Geist, Geist_Mono, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Variable font; only the Bengali subset — Latin comes from Geist.
const notoBengali = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["bengali"],
  display: "swap",
});

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "PrimePlot",
    template: "%s · PrimePlot",
  },
  description: "Real estate showcase, CRM and sales management.",
};

export const viewport = {
  themeColor: "#f6f4ef",
};

export default function RootLayout({ children }) {
  // `lang` becomes dynamic (bn/en) with i18n in F1.
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${notoBengali.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-canvas text-ink" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
