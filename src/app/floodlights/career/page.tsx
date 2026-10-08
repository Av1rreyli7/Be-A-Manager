import type { Metadata } from "next";
import CareerApp from "@/career/CareerApp";

export const metadata: Metadata = {
  title: { absolute: "Player Career · Floodlights" },
  description: "Create one footballer and live his whole career, from a school pitch to the biggest stadiums, in the same world as Floodlights Manager Career.",
};

export default function Page() {
  return <CareerApp />;
}
