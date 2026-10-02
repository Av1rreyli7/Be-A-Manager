import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toasts } from "@/components/Toasts";
import { BOOT_SCRIPT } from "@/lib/appearanceBoot";
import { chakra, inter } from "@/lib/fonts";

// The site's two faces, the same files the landing page and Floodlights use:
// Inter for reading and headings, Chakra Petch for small labels and big numbers.

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
  themeColor: "#000000",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${chakra.variable} h-full antialiased`} data-mode="dark" data-style="colorful" suppressHydrationWarning>
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
