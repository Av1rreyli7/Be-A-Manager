import { describe, expect, it } from "vitest";
import teams from "../data/teams.json";
import players from "../data/players.json";
import contracts from "../data/contracts.json";
import picks from "../data/draftPicks.json";
import { createLeague } from "../src/engine/league/init";
import { simTo } from "../src/engine/league/advance";
import { applyOps, diff } from "../src/lib/online/diff";

describe("online sync diff", () => {
  it("patching a copy reproduces a simulated week exactly", () => {
    const l = createLeague({ teams, players, contracts, picks } as never, { userTeams: ["LAL"], name: "d", rngSeed: 3 });
    l.userTeams = [];
    simTo(l, "week");
    const before = structuredClone(l);
    simTo(l, "week");
    const ops = diff(before, l);
    expect(ops.length).toBeGreaterThan(0);
    applyOps(before, ops);
    expect(JSON.stringify(before)).toBe(JSON.stringify(l));
    // a small UI change stays small
    const b2 = structuredClone(l);
    l.teams.LAL.depth.starters.reverse();
    const small = diff(b2, l);
    expect(JSON.stringify(small).length).toBeLessThan(2000);
    applyOps(b2, small);
    expect(JSON.stringify(b2)).toBe(JSON.stringify(l));
  }, 60000);
});
