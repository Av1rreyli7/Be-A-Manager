/**
 * Play-In Tournament and Playoffs.
 *  Play-In (per conference): 7 hosts 8 (winner = 7 seed); 9 hosts 10 (loser eliminated);
 *  loser of 7/8 hosts winner of 9/10 for the 8 seed.
 *  Playoffs: 1v8, 4v5, 3v6, 2v7; best-of-7, 2-2-1-1-1 home pattern; bracket is fixed (no reseeding).
 *  Finals home court goes to the better regular-season record.
 */
import type { League, PlayInGame, PlayoffSeries, ScheduledGame, TeamId } from "../types/game";
import { addDays, seasonCalendar, seasonStartYear } from "../util/dates";
import { conferenceStandings, winPct, emptyRecord } from "./standings";
import { hashString } from "../ratings/ratings";

export function startPlayIn(l: League) {
  const cal = seasonCalendar(seasonStartYear(l.season));
  l.playIn = [];
  for (const conf of ["East", "West"] as const) {
    const order = conferenceStandings(l, conf);
    const [s7, s8, s9, s10] = order.slice(6, 10);
    const g78: PlayInGame = { id: `pi-${conf}-78`, conference: conf, kind: "7v8", home: s7, away: s8 };
    const g910: PlayInGame = { id: `pi-${conf}-910`, conference: conf, kind: "9v10", home: s9, away: s10 };
    l.playIn.push(g78, g910);
    const d = conf === "East" ? cal.playInStart : addDays(cal.playInStart, 1);
    for (const g of [g78, g910]) {
      g.gameId = `${l.season}-${g.id}`;
      l.schedule.push({ id: g.gameId, date: d, home: g.home, away: g.away, type: "play-in", round: `Play-In ${g.kind} (${conf})`, played: false });
    }
  }
}

export function onPlayInResult(l: League, g: ScheduledGame) {
  const pi = l.playIn.find((x) => x.gameId === g.id);
  if (!pi || !g.result) return;
  pi.winner = g.result.homeScore > g.result.awayScore ? g.home : g.away;
  pi.loser = pi.winner === g.home ? g.away : g.home;
  const conf = pi.conference;
  const g78 = l.playIn.find((x) => x.conference === conf && x.kind === "7v8");
  const g910 = l.playIn.find((x) => x.conference === conf && x.kind === "9v10");
  if (g78?.winner && g910?.winner && !l.playIn.some((x) => x.conference === conf && x.kind === "final")) {
    const fin: PlayInGame = { id: `pi-${conf}-final`, conference: conf, kind: "final", home: g78.loser!, away: g910.winner!, gameId: `${l.season}-pi-${conf}-final` };
    l.playIn.push(fin);
    const cal = seasonCalendar(seasonStartYear(l.season));
    l.schedule.push({ id: fin.gameId!, date: addDays(cal.playInStart, 3), home: fin.home, away: fin.away, type: "play-in", round: `Play-In final (${conf})`, played: false });
  }
}

export function playInComplete(l: League): boolean {
  return l.playIn.filter((x) => x.kind === "final" && x.winner).length === 2;
}

/** Seeds 1-8 for a conference after the play-in. */
export function playoffSeeds(l: League, conf: "East" | "West"): TeamId[] {
  const order = conferenceStandings(l, conf);
  const s7 = l.playIn.find((x) => x.conference === conf && x.kind === "7v8")?.winner ?? order[6];
  const s8 = l.playIn.find((x) => x.conference === conf && x.kind === "final")?.winner ?? order[7];
  return [...order.slice(0, 6), s7, s8];
}

function scheduleSeriesGame(l: League, s: PlayoffSeries, date: string) {
  const n = s.games.length; // 0-based game number
  const highHome = [0, 1, 4, 6].includes(n);
  const id = `${l.season}-po-${s.id}-g${n + 1}`;
  s.games.push(id);
  l.schedule.push({
    id,
    date,
    home: highHome ? s.high : s.low,
    away: highHome ? s.low : s.high,
    type: "playoffs",
    round: roundName(s),
    seriesId: s.id,
    played: false,
  });
}

export function roundName(s: PlayoffSeries): string {
  if (s.conference === "Finals") return "NBA Finals";
  return s.round === 1 ? `${s.conference} First Round` : s.round === 2 ? `${s.conference} Semifinals` : `${s.conference} Finals`;
}

export function startPlayoffs(l: League) {
  const cal = seasonCalendar(seasonStartYear(l.season));
  l.playoffs = [];
  for (const conf of ["East", "West"] as const) {
    const seeds = playoffSeeds(l, conf);
    const pairs: [number, number][] = [[1, 8], [4, 5], [3, 6], [2, 7]];
    pairs.forEach(([a, b], i) => {
      const s: PlayoffSeries = { id: `${conf[0]}1-${i + 1}`, round: 1, conference: conf, high: seeds[a - 1], low: seeds[b - 1], highSeed: a, lowSeed: b, winsHigh: 0, winsLow: 0, games: [] };
      l.playoffs.push(s);
      scheduleSeriesGame(l, s, addDays(cal.playoffsStart, i % 2));
    });
  }
}

function betterRecord(l: League, a: TeamId, b: TeamId): boolean {
  const ra = l.standings[a] ?? emptyRecord(a);
  const rb = l.standings[b] ?? emptyRecord(b);
  const d = winPct(ra) - winPct(rb);
  if (Math.abs(d) > 1e-9) return d > 0;
  const hh = (ra.vs[b]?.w ?? 0) - (rb.vs[a]?.w ?? 0);
  if (hh) return hh > 0;
  return hashString(l.season + a) > hashString(l.season + b);
}

export function onPlayoffResult(l: League, g: ScheduledGame) {
  const s = l.playoffs.find((x) => x.id === g.seriesId);
  if (!s || !g.result) return;
  const winner = g.result.homeScore > g.result.awayScore ? g.home : g.away;
  if (winner === s.high) s.winsHigh++;
  else s.winsLow++;
  if (s.winsHigh === 4 || s.winsLow === 4) {
    s.winner = s.winsHigh === 4 ? s.high : s.low;
    const loser = s.winner === s.high ? s.low : s.high;
    l.news.unshift({ id: `ser${s.id}${l.season}`, date: g.date, type: "game", text: `${l.teams[s.winner].fullName} defeat the ${l.teams[loser].name} ${Math.max(s.winsHigh, s.winsLow)}-${Math.min(s.winsHigh, s.winsLow)} (${roundName(s)}).`, teams: [s.winner, loser], players: [], important: s.conference === "Finals" || s.round >= 3 });
    advanceBracket(l, s, g.date);
  } else {
    const gap = s.games.length === 2 || s.games.length === 4 || s.games.length === 5 ? 3 : 2;
    scheduleSeriesGame(l, s, addDays(g.date, gap));
  }
}

function advanceBracket(l: League, done: PlayoffSeries, date: string) {
  const round = done.round;
  const conf = done.conference;
  if (conf === "Finals") return;
  const same = l.playoffs.filter((s) => s.round === round && s.conference === conf);
  if (round < 3) {
    // pair adjacent bracket slots: (1v8 & 4v5), (3v6 & 2v7)
    const idx = same.indexOf(done);
    const partnerIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    const partner = same[partnerIdx];
    if (!partner?.winner) return;
    const a = same[Math.min(idx, partnerIdx)];
    const b = same[Math.max(idx, partnerIdx)];
    const seedOf = (s: PlayoffSeries) => (s.winner === s.high ? s.highSeed : s.lowSeed);
    const [hi, lo] = seedOf(a) < seedOf(b) ? [a, b] : [b, a];
    const next: PlayoffSeries = { id: `${conf[0]}${round + 1}-${Math.floor(Math.min(idx, partnerIdx) / 2) + 1}`, round: round + 1, conference: conf, high: hi.winner!, low: lo.winner!, highSeed: seedOf(hi), lowSeed: seedOf(lo), winsHigh: 0, winsLow: 0, games: [] };
    l.playoffs.push(next);
    scheduleSeriesGame(l, next, addDays(date, 2));
  } else {
    const east = l.playoffs.find((s) => s.round === 3 && s.conference === "East");
    const west = l.playoffs.find((s) => s.round === 3 && s.conference === "West");
    if (!east?.winner || !west?.winner) return;
    const eHigh = betterRecord(l, east.winner, west.winner);
    const fin: PlayoffSeries = { id: "F", round: 4, conference: "Finals", high: eHigh ? east.winner : west.winner, low: eHigh ? west.winner : east.winner, highSeed: 1, lowSeed: 1, winsHigh: 0, winsLow: 0, games: [] };
    l.playoffs.push(fin);
    scheduleSeriesGame(l, fin, addDays(date, 3));
  }
}

export function champion(l: League): TeamId | null {
  return l.playoffs.find((s) => s.conference === "Finals")?.winner ?? null;
}
