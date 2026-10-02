import type { SeedData } from "@/engine/league/init";

/** Seed data is ~1.3 MB, so it's loaded on demand when starting a new league. */
export async function loadSeed(): Promise<SeedData> {
  const [teams, players, contracts, picks, cba, ratingOverrides] = await Promise.all([
    import("../../data/teams.json").then((m) => m.default),
    import("../../data/players.json").then((m) => m.default),
    import("../../data/contracts.json").then((m) => m.default),
    import("../../data/draftPicks.json").then((m) => m.default),
    import("../../data/cba.json").then((m) => m.default),
    import("../../data/ratingOverrides.json").then((m) => m.default as unknown as Record<string, number>),
  ]);
  return { teams, players, contracts, picks, cba, ratingOverrides, fetchedAt: (cba as { generatedAt?: string }).generatedAt } as unknown as SeedData;
}

export async function loadTeamsOnly() {
  return (await import("../../data/teams.json")).default;
}
