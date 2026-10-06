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

/**
 * First paint guard for the intro. It runs while the HTML is still being read, before anything below it is
 * painted, and hides the pieces the intro brings in, so the page never shows its end state first. GSAP takes
 * over and removes it; if the scripts never arrive it lifts itself after 4.5 seconds. Reduced motion users
 * never get it, and a second visit in the same tab skips the welcome layer.
 */
const PREHIDE = `(function(){try{if(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches)return;var seen=false;try{seen=sessionStorage.getItem("bam:intro")==="seen"}catch(e){}var s=document.createElement("style");s.id="bam-prehide";s.textContent=".bam-card,.bam-brand,.bam-by,.bam-beam,.bam-lamps i,.bam-frame .ln,.bam-frame .cn{opacity:0}.bam-dim{opacity:1}"+(seen?"":".bam-intro{display:flex}.bam-big .L,.bam-welcome .ch,.bam-welcome .rule{opacity:0}");document.head.appendChild(s);setTimeout(function(){if(!window.__bamIntro){var x=document.getElementById("bam-prehide");if(x)x.remove()}},4500)}catch(e){}})();`;

export default function Page() {
  return (
    <main id="main" style={{ background: "#000", color: "#fff" }}>
      <script dangerouslySetInnerHTML={{ __html: PREHIDE }} />
      <Landing fontVars={`${inter.variable} ${chakra.variable} ${instrument.variable}`} />
    </main>
  );
}
