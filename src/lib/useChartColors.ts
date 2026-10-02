"use client";
import { useGame } from "./store";
import { chartColors } from "./theme";
import { useResolvedAppearance } from "./appearance";

/** Chart palette for the team currently being managed. */
export function useChartColors() {
  const colors = useGame((s) => (s.team && s.league ? s.league.teams[s.team]?.colors : undefined));
  return chartColors(colors, useResolvedAppearance());
}
