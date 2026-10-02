import type { Metadata, Viewport } from "next";
import Landing from "@/landing/Landing";
import { chakra, inter, instrument } from "@/lib/fonts";

export const metadata: Metadata = {
  title: { absolute: "Be-A-Manager" },
  description: "Run a football club with your friends in Floodlights, or open Game Night for two basketball games in one: Front Office, where you are the GM, and Hardwood Legends, where you play the games yourself.",
  openGraph: {
    title: "Be-A-Manager",
    description: "Floodlights and Game Night on one site.",
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
