/** Minimal synthetic league for rule tests: real team list, hand-made players/contracts. */
import teams from "../data/teams.json";
import type { Contract, League, Player } from "../src/engine/types/game";
import type { SeedTeam } from "../src/engine/types/seed";
import { createLeague } from "../src/engine/league/init";
import { ATTRIBUTE_KEYS } from "../src/engine/types/game";
import { nextSeason } from "../src/engine/util/dates";

export function emptyLeague(): League {
  const l = createLeague({ teams: teams as SeedTeam[], players: [], contracts: [], picks: [] }, { userTeams: ["LAL"], name: "test", rngSeed: 1 });
  l.phase = "regular";
  l.date = "2026-11-20";
  for (const t of Object.values(l.teams)) {
    t.hardCap = null;
    t.exceptions = { mleUsed: 0, mleType: null, baeUsed: 0, baeLastUsedSeason: null, tpes: [], dpe: null, roomUsed: 0 };
    t.taxHistory = [];
  }
  // every team owns its own picks for the window
  for (const t of Object.keys(l.teams))
    for (let y = 2027; y <= 2033; y++)
      for (const r of [1, 2] as const) l.picks[`${y}-${r}-${t}`] = { id: `${y}-${r}-${t}`, year: y, round: r, originalTeam: t, owner: t, protection: { kind: "none", text: "unprotected" }, swap: false, conditional: false, frozen: false, forfeited: false, terms: [] };
  return l;
}

let seq = 0;
export function addPlayer(l: League, teamId: string | null, salary: number, opts: Partial<Player> & { years?: number; contract?: Partial<Contract> } = {}): Player {
  const id = `t${++seq}`;
  const ratings = Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, 60])) as Player["ratings"];
  const p: Player = {
    id, name: `Player ${id}`, firstName: "Player", lastName: id, teamId, status: teamId ? "active" : "fa", dob: "1998-01-01",
    born: { place: null, country: "USA" }, college: null, heightIn: 79, weightLb: 215, pos: "SF", positions: ["F"], jersey: null,
    experience: 5, draft: null, ratings, ovr: 70, pot: 70,
    tendencies: { usage: 0.2, threeRate: 0.35, rimRate: 0.5, ftRate: 0.25, astRate: 0.12, tovRate: 0.12, orebRate: 0.04, drebRate: 0.14, stlRate: 0.015, blkRate: 0.01, foulRate: 0.04 },
    traits: [], personality: { loyalty: 50, winning: 50, money: 50, playTime: 50, workEthic: 50, ego: 50 }, morale: 60, tradeRequest: false, injury: null,
    contractId: null, seasonsWithTeam: 2, gLeague: false, realStats: [], stats: [], awards: [], ratingHistory: [],
    ...opts,
  };
  l.players[id] = p;
  l.nextId += 1; // invalidate memoised roster/salary indexes
  if (teamId && salary > 0) {
    const years: Contract["years"] = [];
    let s = l.season;
    for (let i = 0; i < (opts.years ?? 2); i++) {
      years.push({ season: s, salary, guaranteed: salary, option: null });
      s = nextSeason(s);
    }
    const c: Contract = { id: `c-${id}`, playerId: id, playerName: p.name, teamId, type: "standard", years, tradeKicker: null, noTradeClause: false, signedDate: "2025-07-10", deadMoney: false, notes: [], ...opts.contract };
    l.contracts[c.id] = c;
    p.contractId = c.id;
  }
  return p;
}

/** Fill a team with filler contracts up to a total salary (13 players). */
export function fillTo(l: League, teamId: string, total: number, count = 13) {
  const each = Math.round(total / count);
  const out: Player[] = [];
  for (let i = 0; i < count; i++) out.push(addPlayer(l, teamId, each));
  return out;
}

export function twoTeam(a: string, b: string, aPlayers: string[], bPlayers: string[], extra: { aPicks?: string[]; bPicks?: string[]; aCash?: number } = {}) {
  return {
    sides: [
      { teamId: a, players: aPlayers, picks: extra.aPicks ?? [], cash: extra.aCash ?? 0 },
      { teamId: b, players: bPlayers, picks: extra.bPicks ?? [], cash: 0 },
    ],
    destinations: {},
  };
}
