import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Landing from "@/landing/Landing";

// Self hosted latin subsets. The same files serve the Floodlights client at /floodlights/fonts/.
const inter = localFont({ src: "../../floodlights/fonts/inter.woff2", weight: "100 900", style: "normal", display: "swap", variable: "--font-inter", fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"] });
const chakra = localFont({ src: "../../floodlights/fonts/chakra-petch-700.woff2", weight: "700", style: "normal", display: "swap", variable: "--font-chakra", fallback: ["system-ui", "sans-serif"] });
const instrument = localFont({ src: "../../floodlights/fonts/instrument-serif-italic.woff2", weight: "400", style: "italic", display: "swap", variable: "--font-instrument", fallback: ["Times New Roman", "Times", "serif"], preload: false });

export const metadata: Metadata = {
  title: { absolute: "Be-A-Manager" },
  description: "Two manager games on one site. Run a football club in Floodlights or a basketball franchise in Front Office, with your friends.",
  openGraph: {
    title: "Be-A-Manager",
    description: "Two manager games on one site: Floodlights and Front Office.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function Page() {
  return (
    <main id="main" style={{ background: "#000", color: "#fff" }}>
      <Landing fontVars={`${inter.variable} ${chakra.variable} ${instrument.variable}`} />
    </main>
  );
}
