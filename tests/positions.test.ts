import { describe, expect, it } from "vitest";
import teams from "../data/teams.json";
import players from "../data/players.json";
import contracts from "../data/contracts.json";
import picks from "../data/draftPicks.json";
import type { SeedContract, SeedPick, SeedPlayer, SeedTeam } from "../src/engine/types/seed";
import { createLeague } from "../src/engine/league/init";
import { bestLineup, outOfPosition, posScore } from "../src/engine/league/positions";

const l = createLeague({ teams: teams as SeedTeam[], players: players as SeedPlayer[], contracts: contracts as SeedContract[], picks: picks as SeedPick[] }, { userTeams: [], name: "t", rngSeed: 3 });

describe("positions & rotations", () => {
  it("no team starts anyone clearly out of position", () => {
    for (const t of Object.values(l.teams)) {
      t.depth.starters.forEach((id, slot) => {
        expect(outOfPosition(l.players[id], slot), `${t.id} ${l.players[id].name} at slot ${slot}`).toBe(false);
      });
    }
  });
  it("starters are ordered PG → C by positional score", () => {
    for (const t of Object.values(l.teams)) {
      const s = t.depth.starters.map((id) => posScore(l.players[id]));
      expect(s[0]).toBeLessThanOrEqual(s[4]);
    }
  });
  it("listed centers are centers and guards are guards", () => {
    const jokic = Object.values(l.players).find((p) => p.name === "Nikola Jokic")!;
    const curry = Object.values(l.players).find((p) => p.name === "Stephen Curry")!;
    expect(jokic.pos).toBe("C");
    expect(curry.pos).toBe("PG");
  });
  it("bestLineup never puts two point guards in the frontcourt", () => {
    const guards = Object.values(l.players).filter((p) => p.pos === "PG").slice(0, 7);
    const bigs = Object.values(l.players).filter((p) => p.pos === "C").slice(0, 3);
    const lineup = bestLineup([...guards, ...bigs]);
    expect(lineup[4].pos).toBe("C");
  });
});
