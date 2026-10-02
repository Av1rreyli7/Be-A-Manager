import { describe, expect, it } from "vitest";
import teams from "../data/teams.json";
import players from "../data/players.json";
import contracts from "../data/contracts.json";
import picks from "../data/draftPicks.json";
import type { League } from "../src/engine/types/game";
import { createLeague } from "../src/engine/league/init";
import { recordPlayedGame, simTo } from "../src/engine/league/advance";
import { autoTrimRoster } from "../src/engine/league/transactions";
import { buildStart, playableGame, toBoxScore, type HLResult } from "../src/lib/hardwood";

const ME = "LAL";

function league(): League {
  const l = createLeague({ teams, players, contracts, picks } as never, { userTeams: [ME], name: "hl", rngSeed: 7 });
  autoTrimRoster(l, ME);
  return l;
}

/** A fake Hardwood Legends result: every player who started scores, the user team wins by `margin` HL points. */
function fakeResult(l: League, gameId: string, qLen: number, margin: number): HLResult {
  const g = l.schedule.find((x) => x.id === gameId)!;
  const s = buildStart(l, g, ME, { qLen, diff: 1 });
  const side = (t: typeof s.user, base: number) => {
    const ps = t.players.map((p, i) => ({
      foId: p[7],
      starter: i < 5,
      stats: { pts: i < 5 ? base : 0, reb: 3, oreb: 1, ast: 2, stl: 1, blk: 0, fgm: i < 5 ? Math.ceil(base / 2) : 0, fga: 8, tpm: 0, tpa: 2, ftm: 0, fta: 0, to: 1, pf: 2, sec: i < 5 ? qLen * 60 * 3 : 0 },
    }));
    const score = ps.reduce((a, p) => a + p.stats.pts, 0);
    return { abbr: t.abbr, score, qpts: [score / 4, score / 4, score / 4, score / 4], players: ps };
  };
  return { gameId, qLen, userHome: s.userHome, teams: [side(s.user, 4 + margin), side(s.opp, 4)] };
}

describe("Hardwood Legends bridge", () => {
  it("game-day stops on the morning of the user's game without playing it", () => {
    const l = league();
    simTo(l, "game-day", undefined, { team: ME });
    const g = playableGame(l, ME);
    expect(g).not.toBeNull();
    expect(g!.played).toBe(false);
    expect(g!.date <= l.date).toBe(true);
    // nothing else for the user was skipped
    expect(l.schedule.filter((x) => x.played && (x.home === ME || x.away === ME)).length).toBe(0);
  });

  it("only stops for the given team (friends leagues have many user teams)", () => {
    const l = league();
    l.userTeams = Object.keys(l.teams);
    for (const t of l.userTeams) autoTrimRoster(l, t); // every user team must be legal for opening night
    simTo(l, "game-day", undefined, { team: ME });
    expect(playableGame(l, ME)).not.toBeNull();
  });

  it("records a hand-played game like a simmed one, scaled to 48 minutes", () => {
    const l = league();
    simTo(l, "game-day", undefined, { team: ME });
    const g = playableGame(l, ME)!;
    const box = toBoxScore(l, g, fakeResult(l, g.id, 5, 2));
    expect(recordPlayedGame(l, g.id, box)).toBeNull();
    expect(g.played).toBe(true);
    const mine = g.home === ME ? g.result!.homeScore : g.result!.awayScore;
    const theirs = g.home === ME ? g.result!.awayScore : g.result!.homeScore;
    expect(mine).toBeGreaterThan(theirs); // HL's winner is kept
    expect(mine).toBeGreaterThanOrEqual(70); // 5-minute quarters scaled up: 5 starters x round(6 HL pts x 2.4)
    expect(l.standings[ME].w).toBe(1);
    expect(l.boxScores[g.id]).toBeDefined();
    const starter = box.lines[g.home === ME ? "home" : "away"].find((b) => b.starter)!;
    expect(starter.min).toBe(36); // 15 HL minutes x 12/5
    expect(l.gameLog[starter.playerId]?.at(-1)?.gameId).toBe(g.id);
    // the sim carries on afterwards without replaying it
    simTo(l, "day");
    expect(l.schedule.filter((x) => x.id === g.id).length).toBe(1);
    expect(l.standings[ME].w + l.standings[ME].l).toBe(1);
  });

  it("refuses a result once the game has been simmed (the host's sim wins)", () => {
    const l = league();
    simTo(l, "game-day", undefined, { team: ME });
    const g = playableGame(l, ME)!;
    const box = toBoxScore(l, g, fakeResult(l, g.id, 5, 2));
    simTo(l, "day"); // host sims while the user is still playing
    expect(g.played).toBe(true);
    expect(recordPlayedGame(l, g.id, box)).toMatch(/already been played/);
  });

  it("caps the scale so fast short-quarter games stay at realistic NBA totals", () => {
    const l = league();
    simTo(l, "game-day", undefined, { team: ME });
    const g = playableGame(l, ME)!;
    const r = fakeResult(l, g.id, 2, 4); // 2-minute quarters: 40-20 in HL would be 240-120 at a straight x6
    const box = toBoxScore(l, g, r);
    const total = box.summary.homeScore + box.summary.awayScore;
    expect(total).toBeGreaterThan(200);
    expect(total).toBeLessThan(250);
  });

  it("never records a tie, even when rounding would make one", () => {
    const l = league();
    simTo(l, "game-day", undefined, { team: ME });
    const g = playableGame(l, ME)!;
    const r = fakeResult(l, g.id, 12, 0);
    r.teams[0].score += 1; // HL says the user won by one; player lines alone are level
    const box = toBoxScore(l, g, r);
    expect(box.summary.homeScore).not.toBe(box.summary.awayScore);
    const userHome = g.home === ME;
    expect(userHome ? box.summary.homeScore > box.summary.awayScore : box.summary.awayScore > box.summary.homeScore).toBe(true);
  });
});
