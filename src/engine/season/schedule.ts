/**
 * 82-game schedule in the NBA format:
 *   4 division opponents × 4 games                 = 16
 *   6 same-conference opponents × 4 games          = 24
 *   4 same-conference opponents × 3 games (rotating) = 12
 *   15 other-conference opponents × 2 games        = 30
 * With the NBA Cup enabled, each team's 4 group games are part of these, and 2 games per team are held
 * back (80 predetermined) to be filled after the group stage (knockout games / pairings).
 */
import type { ScheduledGame, Team, TeamId } from "../types/game";
import { addDays, dayOfWeek, seasonCalendar } from "../util/dates";
import { Rng } from "../util/rng";

interface Matchup {
  home: TeamId;
  away: TeamId;
  cupGroup?: string;
}

export function buildMatchups(teams: Team[], rng: Rng): Matchup[] {
  const games: Matchup[] = [];
  const conf = (c: "East" | "West") => teams.filter((t) => t.conference === c);
  for (const c of ["East", "West"] as const) {
    const ct = conf(c);
    const divisions = [...new Set(ct.map((t) => t.division))].sort();
    const divTeams = divisions.map((d) => rng.shuffle(ct.filter((t) => t.division === d)));
    // division: 4 games (2/2)
    for (const dt of divTeams) {
      for (let i = 0; i < dt.length; i++)
        for (let j = i + 1; j < dt.length; j++) {
          games.push({ home: dt[i].id, away: dt[j].id }, { home: dt[i].id, away: dt[j].id }, { home: dt[j].id, away: dt[i].id }, { home: dt[j].id, away: dt[i].id });
        }
    }
    // cross-division within conference: 2-regular bipartite graph of 3-game series, rest 4 games
    for (let a = 0; a < divTeams.length; a++)
      for (let b = a + 1; b < divTeams.length; b++) {
        const A = divTeams[a];
        const B = divTeams[b];
        const k = rng.int(0, 4);
        for (let i = 0; i < A.length; i++)
          for (let j = 0; j < B.length; j++) {
            const d = (((j - i - k) % 5) + 5) % 5;
            if (d === 0) {
              // 3 games, A hosts 2
              games.push({ home: A[i].id, away: B[j].id }, { home: A[i].id, away: B[j].id }, { home: B[j].id, away: A[i].id });
            } else if (d === 1) {
              // 3 games, B hosts 2
              games.push({ home: B[j].id, away: A[i].id }, { home: B[j].id, away: A[i].id }, { home: A[i].id, away: B[j].id });
            } else {
              games.push({ home: A[i].id, away: B[j].id }, { home: A[i].id, away: B[j].id }, { home: B[j].id, away: A[i].id }, { home: B[j].id, away: A[i].id });
            }
          }
      }
  }
  // inter-conference: 1 home, 1 away
  const east = conf("East");
  const west = conf("West");
  for (const e of east) for (const w of west) games.push({ home: e.id, away: w.id }, { home: w.id, away: e.id });
  return games;
}

/** Pentagon round robin: each team hosts the next two teams around the circle (2 home / 2 away). */
export function cupGroupGames(groups: Record<string, TeamId[]>): Matchup[] {
  const out: Matchup[] = [];
  for (const [g, ids] of Object.entries(groups)) {
    for (let i = 0; i < ids.length; i++) {
      out.push({ home: ids[i], away: ids[(i + 1) % ids.length], cupGroup: g });
      out.push({ home: ids[i], away: ids[(i + 2) % ids.length], cupGroup: g });
    }
  }
  return out;
}

function markCupGames(games: Matchup[], cup: Matchup[]) {
  for (const cg of cup) {
    let idx = games.findIndex((g) => !g.cupGroup && g.home === cg.home && g.away === cg.away);
    if (idx < 0) {
      idx = games.findIndex((g) => !g.cupGroup && g.home === cg.away && g.away === cg.home);
      if (idx >= 0) games[idx] = { home: cg.home, away: cg.away };
    }
    if (idx >= 0) games[idx].cupGroup = cg.cupGroup;
    else games.push({ ...cg });
  }
}

/** Hold back two inter-conference games per team (one home, one away) for Cup-determined games. */
function holdBackTwo(games: Matchup[], teams: Team[], rng: Rng): Matchup[] {
  const east = teams.filter((t) => t.conference === "East").map((t) => t.id);
  const west = rng.shuffle(teams.filter((t) => t.conference === "West").map((t) => t.id));
  const remove: Matchup[] = [];
  east.forEach((e, i) => {
    remove.push({ home: e, away: west[i % west.length] });
    remove.push({ home: west[(i + 1) % west.length], away: e });
  });
  const out = [...games];
  for (const r of remove) {
    const idx = out.findIndex((g) => !g.cupGroup && g.home === r.home && g.away === r.away);
    if (idx >= 0) out.splice(idx, 1);
  }
  return out;
}

/** Trim to a shorter season: keep games while both teams are under the target. */
function trimToLength(games: Matchup[], n: number, rng: Rng): Matchup[] {
  const count: Record<string, number> = {};
  const out: Matchup[] = [];
  const cup = games.filter((g) => g.cupGroup);
  for (const g of cup) {
    out.push(g);
    count[g.home] = (count[g.home] ?? 0) + 1;
    count[g.away] = (count[g.away] ?? 0) + 1;
  }
  for (const g of rng.shuffle(games.filter((x) => !x.cupGroup))) {
    if ((count[g.home] ?? 0) < n && (count[g.away] ?? 0) < n) {
      out.push(g);
      count[g.home] = (count[g.home] ?? 0) + 1;
      count[g.away] = (count[g.away] ?? 0) + 1;
    }
  }
  return out;
}

export interface ScheduleOptions {
  startYear: number;
  gamesPerTeam: number;
  cupGroups: Record<string, TeamId[]> | null;
}

export function generateSchedule(teams: Team[], opts: ScheduleOptions, rng: Rng, idPrefix = "g"): ScheduledGame[] {
  const cal = seasonCalendar(opts.startYear);
  let games = buildMatchups(teams, rng);
  if (opts.cupGroups) {
    markCupGames(games, cupGroupGames(opts.cupGroups));
    games = holdBackTwo(games, teams, rng);
  }
  const target = opts.cupGroups ? opts.gamesPerTeam - 2 : opts.gamesPerTeam;
  if (target < 80) games = trimToLength(games, target, rng);

  // ---- dates ----
  const cupNights: string[] = [];
  if (opts.cupGroups) {
    for (let d = cal.cupGroupStart; d <= cal.cupGroupEnd; d = addDays(d, 1)) {
      const w = dayOfWeek(d);
      if (w === 2 || w === 5) cupNights.push(d);
    }
  }
  const blocked = new Set<string>();
  for (let d = cal.allStarBreakStart; d <= cal.allStarBreakEnd; d = addDays(d, 1)) blocked.add(d);
  if (opts.cupGroups) {
    for (let d = addDays(cal.cupQuarterfinals, 0); d <= cal.cupFinal; d = addDays(d, 1)) blocked.add(d);
  }
  const lastPlayed: Record<string, string[]> = {};
  const scheduled: ScheduledGame[] = [];
  let seq = 0;
  const place = (g: Matchup, date: string) => {
    scheduled.push({ id: `${idPrefix}${opts.startYear}-${++seq}`, date, home: g.home, away: g.away, type: g.cupGroup ? "cup-group" : "regular", cupGroup: g.cupGroup, played: false });
    (lastPlayed[g.home] ??= []).push(date);
    (lastPlayed[g.away] ??= []).push(date);
  };

  // cup group nights first
  const cupGames = rng.shuffle(games.filter((g) => g.cupGroup));
  const pendingCup = [...cupGames];
  for (const night of cupNights) {
    const busy = new Set<string>();
    for (let i = 0; i < pendingCup.length; i++) {
      const g = pendingCup[i];
      if (busy.has(g.home) || busy.has(g.away)) continue;
      place(g, night);
      busy.add(g.home);
      busy.add(g.away);
      pendingCup.splice(i--, 1);
    }
  }
  const remaining = rng.shuffle([...games.filter((g) => !g.cupGroup), ...pendingCup]);
  const cupNightSet = new Set(cupNights);

  const days: string[] = [];
  for (let d = cal.tipoff; d <= cal.regularSeasonEnd; d = addDays(d, 1)) if (!blocked.has(d) && !cupNightSet.has(d)) days.push(d);
  const playedOn = (t: string, d: string) => (lastPlayed[t] ?? []).includes(d);
  const left: Record<string, number> = {};
  for (const g of remaining) {
    left[g.home] = (left[g.home] ?? 0) + 1;
    left[g.away] = (left[g.away] ?? 0) + 1;
  }
  let di = 0;
  while (remaining.length) {
    let date: string;
    if (di < days.length) date = days[di];
    else date = addDays(days[days.length - 1], di - days.length + 1); // overflow: extend season
    di++;
    const daysLeft = Math.max(1, days.length - di + 1);
    const quota = Math.max(1, Math.min(14, Math.round((remaining.length / daysLeft) * rng.range(0.75, 1.3))));
    const busy = new Set<string>();
    // prioritise teams with the most games left
    remaining.sort((a, b) => left[b.home] + left[b.away] - (left[a.home] + left[a.away]) + rng.range(-3, 3));
    let placed = 0;
    for (let i = 0; i < remaining.length && placed < quota; i++) {
      const g = remaining[i];
      if (busy.has(g.home) || busy.has(g.away)) continue;
      const y1 = addDays(date, -1);
      const y2 = addDays(date, -2);
      if ((playedOn(g.home, y1) && playedOn(g.home, y2)) || (playedOn(g.away, y1) && playedOn(g.away, y2))) continue;
      place(g, date);
      busy.add(g.home);
      busy.add(g.away);
      left[g.home]--;
      left[g.away]--;
      remaining.splice(i--, 1);
      placed++;
    }
    if (di > days.length + 60) break; // safety
  }
  scheduled.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return scheduled;
}
