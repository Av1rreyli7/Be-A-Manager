import type { Metadata, Viewport } from "next";
import PrizeApp from "@/prize/PrizeApp";

export const metadata: Metadata = {
  title: { absolute: "PRIZE FIGHTER" },
  description: "First person boxing in 3D. Fight as a real legend or a boxer you build yourself, full rounds under the ring lights.",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function Page() {
  return <PrizeApp />;
}
