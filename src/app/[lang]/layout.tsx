import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { getLocale } from "@/lib/i18n";
import { locales } from "@/lib/locales";
import "../globals.css";

// Font files are committed in src/fonts (SIL Open Font License), so builds
// don't depend on reaching Google Fonts.
const inter = localFont({
  src: "../../fonts/inter-latin-var.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const yaldevi = localFont({
  src: [
    { path: "../../fonts/yaldevi-sinhala-400-normal.woff2", weight: "400" },
    { path: "../../fonts/yaldevi-sinhala-500-normal.woff2", weight: "500" },
    { path: "../../fonts/yaldevi-sinhala-600-normal.woff2", weight: "600" },
  ],
  variable: "--font-yaldevi",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Client Manager", template: "%s · Client Manager" },
  description: "Clients, policies, reminders and documents for an insurance agent.",
  applicationName: "Client Manager",
  appleWebApp: { capable: true, title: "Clients", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#2346b8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const lang = await getLocale();
  return (
    <html lang={lang} className={`${inter.variable} ${yaldevi.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
