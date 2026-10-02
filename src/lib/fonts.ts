/**
 * The site's fonts, loaded once and shared by the landing page and Game Night.
 * Self hosted latin subsets. The same files serve the Floodlights client at /floodlights/fonts/.
 */
import localFont from "next/font/local";

export const inter = localFont({ src: "../../floodlights/fonts/inter.woff2", weight: "100 900", style: "normal", display: "swap", variable: "--font-inter", fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"] });
export const chakra = localFont({ src: "../../floodlights/fonts/chakra-petch-700.woff2", weight: "700", style: "normal", display: "swap", variable: "--font-chakra", fallback: ["system-ui", "sans-serif"] });
export const instrument = localFont({ src: "../../floodlights/fonts/instrument-serif-italic.woff2", weight: "400", style: "italic", display: "swap", variable: "--font-instrument", fallback: ["Times New Roman", "Times", "serif"], preload: false });
