/**
 * NBA Cup (in-season tournament).
 *  - Groups: 3 per conference, 5 teams each, drawn from five pots by previous-season record.
 *  - Group play: 4 games per team on Cup nights (count in regular-season standings).
 *  - Knockout: 3 group winners + 1 wild card per conference. QF hosted by higher seed; SF & final at a
 *    neutral site. QF/SF count in standings; the championship game does not.
 *  - Group tiebreakers: head-to-head, point differential, points scored, previous-season record, draw.
 *  - Teams not in the knockout play two extra games (one home, one away); QF losers play one more.
 */
import type { CupState, League, ScheduledGame, TeamId } from "../types/game";
import { hashString } from "../ratings/ratings";
import { addDays, seasonCalendar, seasonStartYear } from "../util/dates";
import { Rng } from "../util/rng";

export function drawCupGroups(l: League, prevWinPct: Record<TeamId, number>, rng: Rng): Record<string, TeamId[]> {
  const groups: Record<string, TeamId[]> = {};
  for (const conf of ["East", "West"] as const) {
    const ids = Object.values(l.teams)
      .filter((t) => t.conference === conf)
      .map((t) => t.id)
      .sort((a, b) => (prevWinPct[b] ?? 0.5) - (prevWinPct[a] ?? 0.5));
    const names = ["A", "B", "C"].map((x) => `${conf} ${x}`);
    names.forEach((n) => (groups[n] = []));
    for (let pot = 0; pot < 5; pot++) {
      const potTeams = rng.shuffle(ids.slice(pot * 3, pot * 3 + 3));
      potTeams.forEach((t, i) => groups[names[i]].push(t));
    }
  }
  return groups;
}

export interface GroupRow {
  teamId: TeamId;
  w: number;
  l: number;
  pd: number;
  pf: number;
}

export function groupTable(l: League, group: string): GroupRow[] {
  const cup = l.cup!;
  const ids = cup.groups[group];
  const rows: GroupRow[] = ids.map((t) => {
    const s = l.standings[t];
    return { teamId: t, w: s?.cupW ?? 0, l: s?.cupL ?? 0, pd: s?.cupPd ?? 0, pf: s?.cupPf ?? 0 };
  });
  const games = l.schedule.filter((g) => g.type === "cup-group" && g.cupGroup === group && g.played);
  const h2h = (a: TeamId, b: TeamId) => {
    const g = games.find((x) => (x.home === a && x.away === b) || (x.home === b && x.away === a));
    if (!g?.result) return 0;
    const aHome = g.home === a;
    const diff = g.result.homeScore - g.result.awayScore;
    return (aHome ? diff : -diff) > 0 ? 1 : -1;
  };
  return rows.sort((a, b) => {
    if (b.w !== a.w) return b.w - a.w;
    const hh = h2h(b.teamId, a.teamId);
    if (hh) return hh;
    if (b.pd !== a.pd) return b.pd - a.pd;
    if (b.pf !== a.pf) return b.pf - a.pf;
    return hashString(l.season + a.teamId) - hashString(l.season + b.teamId);
  });
}

/** After group play: seed the knockout and schedule QF + the extra games for eliminated teams. */
export function setupKnockout(l: League, rng: Rng): { qfGames: ScheduledGame[]; extra: ScheduledGame[] } {
  const cup = l.cup!;
  const cal = seasonCalendar(seasonStartYear(l.season));
  const qfGames: ScheduledGame[] = [];
  const advancing = new Set<TeamId>();
  for (const conf of ["East", "West"] as const) {
    const groupNames = Object.keys(cup.groups).filter((g) => g.startsWith(conf));
    const winners = groupNames.map((g) => groupTable(l, g)[0]);
    const others = groupNames.flatMap((g) => groupTable(l, g).slice(1));
    const sortRow = (a: GroupRow, b: GroupRow) => b.w - a.w || b.pd - a.pd || b.pf - a.pf;
    winners.sort(sortRow);
    const wild = [...others].sort(sortRow)[0];
    const seeds = [...winners, wild].map((r) => r.teamId);
    seeds.forEach((t) => advancing.add(t));
    const date = conf === "East" ? cal.cupQuarterfinals : addDays(cal.cupQuarterfinals, 1);
    const pairs: [number, number][] = [[0, 3], [1, 2]];
    for (const [h, a] of pairs) {
      const id = `cupqf-${conf}-${h + 1}`;
      cup.knockout.qf.push({ id, home: seeds[h], away: seeds[a] });
      qfGames.push({ id: `${l.season}-${id}`, date, home: seeds[h], away: seeds[a], type: "cup-knockout", round: `Cup QF (${conf})`, played: false });
    }
  }
  // 22 eliminated teams: two extra games each (one home, one away) on the two nights after the QF
  const out = rng.shuffle(Object.keys(l.teams).filter((t) => !advancing.has(t)));
  const extra: ScheduledGame[] = [];
  const d1 = addDays(cal.cupQuarterfinals, 2);
  const d2 = addDays(cal.cupQuarterfinals, 4);
  for (let i = 0; i < out.length; i++) {
    // circle: team i hosts team i+1 on night 1 (even i) / night 2 (odd i) → everyone 1 home, 1 away
    const home = out[i];
    const away = out[(i + 1) % out.length];
    extra.push({ id: `${l.season}-cupx-${i}`, date: i % 2 === 0 ? d1 : d2, home, away, type: "regular", played: false });
  }
  // a circle of even length where each team hosts once: both nights have each team at most once? fix clashes
  fixNightClashes(extra, d1, d2);
  return { qfGames, extra };
}

function fixNightClashes(games: ScheduledGame[], d1: string, d2: string) {
  for (let pass = 0; pass < 4; pass++) {
    const seen = new Map<string, Set<string>>();
    for (const g of games) {
      const s = seen.get(g.date) ?? new Set<string>();
      if (s.has(g.home) || s.has(g.away)) g.date = g.date === d1 ? d2 : g.date === d2 ? addDays(d2, 1) : addDays(g.date, 1);
      else {
        s.add(g.home);
        s.add(g.away);
        seen.set(g.date, s);
      }
    }
  }
}

export function cupDecided(cup: CupState | null): boolean {
  return !!cup?.champion;
}
