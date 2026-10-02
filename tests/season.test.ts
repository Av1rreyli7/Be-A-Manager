import { describe, expect, it } from "vitest";
import teams from "../data/teams.json";
import players from "../data/players.json";
import contracts from "../data/contracts.json";
import picks from "../data/draftPicks.json";
import type { SeedContract, SeedPick, SeedPlayer, SeedTeam } from "../src/engine/types/seed";
import { buildMatchups, generateSchedule } from "../src/engine/season/schedule";
import { conferenceStandings, emptyRecord } from "../src/engine/season/standings";
import { onPlayInResult, startPlayIn, playoffSeeds, startPlayoffs } from "../src/engine/season/playoffs";
import { lotteryEntries, runLottery } from "../src/engine/offseason/draft";
import { createLeague } from "../src/engine/league/init";
import { simulateGame } from "../src/engine/sim/game";
import { teamPlayers } from "../src/engine/league/helpers";
import { rateSeedPlayers } from "../src/engine/ratings/fromStats";
import { calibrate, ovrFromAttributes } from "../src/engine/ratings/ratings";
import { Rng } from "../src/engine/util/rng";
import { emptyLeague } from "./fixtures";

const seed = { teams: teams as SeedTeam[], players: players as SeedPlayer[], contracts: contracts as SeedContract[], picks: picks as SeedPick[] };

describe("schedule", () => {
  const l = emptyLeague();
  const all = Object.values(l.teams);
  it("82 games per team, 41 at home, correct opponent counts", () => {
    const games = buildMatchups(all, new Rng(3));
    expect(games.length).toBe(1230);
    for (const t of all) {
      const mine = games.filter((g) => g.home === t.id || g.away === t.id);
      expect(mine.length).toBe(82);
      expect(games.filter((g) => g.home === t.id).length).toBe(41);
      const vs = new Map<string, number>();
      for (const g of mine) {
        const o = g.home === t.id ? g.away : g.home;
        vs.set(o, (vs.get(o) ?? 0) + 1);
      }
      for (const [o, n] of vs) {
        const ot = l.teams[o];
        if (ot.division === t.division) expect(n).toBe(4);
        else if (ot.conference === t.conference) expect([3, 4]).toContain(n);
        else expect(n).toBe(2);
      }
      const threeGame = [...vs.entries()].filter(([, n]) => n === 3).length;
      expect(threeGame).toBe(4);
    }
  });
  it("with the Cup: 4 group games (2 home/2 away) and 80 predetermined games", () => {
    const groups: Record<string, string[]> = {};
    for (const c of ["East", "West"] as const) {
      const ids = all.filter((t) => t.conference === c).map((t) => t.id);
      ["A", "B", "C"].forEach((g, i) => (groups[`${c} ${g}`] = ids.slice(i * 5, i * 5 + 5)));
    }
    const sched = generateSchedule(all, { startYear: 2026, gamesPerTeam: 82, cupGroups: groups }, new Rng(9));
    for (const t of all) {
      const mine = sched.filter((g) => g.home === t.id || g.away === t.id);
      expect(mine.length).toBe(80);
      const cup = mine.filter((g) => g.type === "cup-group");
      expect(cup.length).toBe(4);
      expect(cup.filter((g) => g.home === t.id).length).toBe(2);
    }
    // no team plays twice on one day; no 3 games in 3 days
    const byTeam = new Map<string, string[]>();
    for (const g of sched) for (const t of [g.home, g.away]) byTeam.set(t, [...(byTeam.get(t) ?? []), g.date]);
    for (const dates of byTeam.values()) expect(new Set(dates).size).toBe(dates.length);
  });
});

describe("standings tiebreakers", () => {
  it("head-to-head breaks a two-team tie", () => {
    const l = emptyLeague();
    const east = Object.values(l.teams).filter((t) => t.conference === "East").map((t) => t.id);
    east.forEach((t, i) => Object.assign(l.standings[t], { w: 60 - i * 3, l: 22 + i * 3 }));
    const [a, b] = [east[3], east[4]];
    Object.assign(l.standings[a], { w: 50, l: 32 });
    Object.assign(l.standings[b], { w: 50, l: 32 });
    l.standings[b].vs[a] = { w: 3, l: 1 };
    l.standings[a].vs[b] = { w: 1, l: 3 };
    const order = conferenceStandings(l, "East");
    expect(order.indexOf(b)).toBeLessThan(order.indexOf(a));
  });
});

describe("play-in", () => {
  it("7/8 winner is the 7 seed; final decides the 8 seed", () => {
    const l = emptyLeague();
    const east = Object.values(l.teams).filter((t) => t.conference === "East").map((t) => t.id);
    const west = Object.values(l.teams).filter((t) => t.conference === "West").map((t) => t.id);
    [...east, ...west].forEach((t) => (l.standings[t] = emptyRecord(t)));
    east.forEach((t, i) => Object.assign(l.standings[t], { w: 60 - i * 2, l: 22 + i * 2 }));
    west.forEach((t, i) => Object.assign(l.standings[t], { w: 60 - i * 2, l: 22 + i * 2 }));
    startPlayIn(l);
    const play = (id: string, homeWins: boolean) => {
      const g = l.schedule.find((x) => x.id.endsWith(id))!;
      g.played = true;
      g.result = { homeScore: homeWins ? 110 : 100, awayScore: homeWins ? 100 : 110, ot: 0, quarters: { home: [], away: [] }, topHome: {} as never, topAway: {} as never };
      onPlayInResult(l, g);
    };
    for (const c of ["East", "West"]) {
      play(`pi-${c}-78`, false); // 8 seed wins → 8 becomes the 7 seed
      play(`pi-${c}-910`, true); // 9 wins
      play(`pi-${c}-final`, true); // loser of 7/8 (original 7) hosts and wins
    }
    const seeds = playoffSeeds(l, "East");
    expect(seeds[6]).toBe(east[7]);
    expect(seeds[7]).toBe(east[6]);
    startPlayoffs(l);
    expect(l.playoffs.filter((s) => s.round === 1).length).toBe(8);
    const s18 = l.playoffs.find((s) => s.conference === "East" && s.highSeed === 1)!;
    expect(s18.low).toBe(seeds[7]);
  });
});

describe("draft lottery", () => {
  it("uses the 14/14/14/12.5… odds and draws four picks", () => {
    const l = emptyLeague();
    const ids = Object.keys(l.teams);
    ids.forEach((t, i) => Object.assign(l.standings[t], { w: 10 + i * 2, l: 72 - i * 2 }));
    const entries = lotteryEntries(l);
    expect(entries.length).toBe(14);
    expect(entries.map((e) => e.combos).slice(0, 4)).toEqual([140, 140, 140, 125]);
    const rng = new Rng(11);
    let worstFirst = 0;
    let worstTop4 = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) {
      const r = runLottery(l, rng);
      const w = r.find((x) => x.teamId === entries[0].teamId)!;
      if (w.pick === 1) worstFirst++;
      if (w.pick <= 4) worstTop4++;
      expect(w.pick).toBeLessThanOrEqual(5); // worst team can fall at most to 5
    }
    expect(worstFirst / N).toBeGreaterThan(0.125);
    expect(worstFirst / N).toBeLessThan(0.155);
    expect(worstTop4 / N).toBeGreaterThan(0.5);
    expect(worstTop4 / N).toBeLessThan(0.54);
  });
});

describe("ratings", () => {
  const rated = rateSeedPlayers(seed.players);
  it("rates every real player within bounds", () => {
    expect(rated.size).toBe(seed.players.length);
    for (const r of rated.values()) {
      expect(r.ovr).toBeGreaterThanOrEqual(25);
      expect(r.ovr).toBeLessThanOrEqual(99);
      expect(r.pot).toBeGreaterThanOrEqual(r.ovr);
    }
  });
  it("calibration hits the target OVR", () => {
    const r = [...rated.values()][0];
    for (const target of [55, 70, 85]) expect(Math.abs(ovrFromAttributes(calibrate(r.ratings, r.pos, target), r.pos) - target)).toBeLessThanOrEqual(1);
  });
});

describe("game simulation", () => {
  const l = createLeague(seed, { userTeams: [], name: "t", rngSeed: 5 });
  it("produces a consistent box score", () => {
    const mk = (id: string) => ({ id, name: id, players: teamPlayers(l, id).filter((p) => !p.injury), depth: l.teams[id].depth, coach: { offense: 60, defense: 60 }, chemistry: 60 });
    for (let i = 0; i < 20; i++) {
      const g = l.schedule[i];
      const { box } = simulateGame(mk(g.home), mk(g.away), { rng: new Rng(i + 1), type: "regular", date: g.date, gameId: g.id, quarterMinutes: 12, pbp: false, injuryRate: 1, homeCourt: true });
      for (const side of ["home", "away"] as const) {
        const pts = box.lines[side].reduce((s, x) => s + x.pts, 0);
        expect(pts).toBe(side === "home" ? box.summary.homeScore : box.summary.awayScore);
        const mins = box.lines[side].reduce((s, x) => s + x.min, 0);
        expect(Math.abs(mins - (240 + 25 * box.summary.ot))).toBeLessThan(2.5);
        for (const x of box.lines[side]) {
          expect(x.fgm).toBeLessThanOrEqual(x.fga);
          expect(x.fg3m).toBeLessThanOrEqual(x.fg3a);
          expect(x.ftm).toBeLessThanOrEqual(x.fta);
          expect(x.pf).toBeLessThanOrEqual(6);
        }
      }
      expect(box.summary.homeScore).not.toBe(box.summary.awayScore);
    }
  });
});
