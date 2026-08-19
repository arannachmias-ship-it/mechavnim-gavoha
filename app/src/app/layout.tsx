import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

/* רוביק בעברית – מוגש מהדומיין שלנו (next/font מוריד בזמן build), לא מ-Google בזמן ריצה */
const rubik = Rubik({ subsets: ["hebrew", "latin"], variable: "--font-rubik", display: "swap" });

export const metadata: Metadata = {
  title: "מכוונים גבוה – נגה",
  description: "תרגול מתמטיקה בשיטה של אבא",
  manifest: "/manifest.json",
  applicationName: "מכוונים גבוה",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "מכוונים גבוה" },
  icons: {
    icon: [{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#F3F3FC", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`h-full antialiased ${rubik.variable}`}>
      <body className="min-h-full flex flex-col">
        <div className="aura-bg" aria-hidden />
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
