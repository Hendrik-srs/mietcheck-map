import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MietCheck Map — Mietspiegel & Fairness-Check für Berlin",
  description:
    "Die transparente Mietkarte für Deutschland: rechtsverbindliche Vergleichsmieten, Fairness-Check und Trends — basierend auf offiziellen Quellen.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://mietcheck-map.vercel.app",
  ),
  openGraph: {
    title: "MietCheck Map",
    description:
      "Transparente Mietpreis-Karte mit Fairness-Check — rein offizielle Datenquellen.",
    locale: "de_DE",
    type: "website",
  },
};

/**
 * Applies the theme before first paint.
 *
 * globals.css defines the palette behind a `.dark` class, so the class has
 * to be on <html> by the time the first frame renders — doing it in an
 * effect would show a white flash to dark-mode users on every navigation.
 * Kept tiny and dependency-free; it runs synchronously in <head>.
 */
const themeScript = `(function(){try{var s=localStorage.getItem("theme");var d=s?s==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}
