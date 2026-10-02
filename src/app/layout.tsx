import type { Metadata, Viewport } from "next";
import { Archivo, Big_Shoulders } from "next/font/google";
import "./globals.css";
import { Toasts } from "@/components/Toasts";
import { BOOT_SCRIPT } from "@/lib/appearanceBoot";

// Archivo: athletic grotesk with tabular figures and a width axis for condensed labels
const body = Archivo({ variable: "--font-body", subsets: ["latin"], axes: ["wdth"], display: "swap" });
// Big Shoulders: condensed arena-signage display face for headings and scoreboard numbers
const display = Big_Shoulders({ variable: "--font-display-face", subsets: ["latin"], axes: ["opsz"], display: "swap", adjustFontFallback: false });

export const metadata: Metadata = {
  title: { default: "Front Office", template: "%s · Front Office" },
  description: "A deep, fast NBA franchise simulator with real 2026-27 rosters, contracts, picks and the full CBA.",
  openGraph: {
    title: "Front Office",
    description: "Run an NBA franchise: real 2026-27 rosters, contracts and the full CBA.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0e13",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} h-full antialiased`} data-mode="dark" data-style="colorful" suppressHydrationWarning>
      <head>
        {/* applies the saved light/dark + style choice before first paint */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[80] focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-accent-ink">
          Skip to content
        </a>
        {children}
        <Toasts />
      </body>
    </html>
  );
}
