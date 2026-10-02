/** Accumulate box scores into season stats, game logs and records. */
import type { BoxLine, BoxScore, League, PlayerSeasonStats, ScheduledGame, StatLine } from "../types/game";
import { emptyLine } from "../types/game";

export function seasonStatsFor(l: League, playerId: string, teamId: string, season = l.season): PlayerSeasonStats {
  const p = l.players[playerId];
  let s = p.stats.find((x) => x.season === season && x.teamId === teamId);
  if (!s) {
    s = { season, teamId, regular: emptyLine(), playoffs: emptyLine() };
    p.stats.push(s);
  }
  return s;
}

function addLine(t: StatLine, b: BoxLine) {
  t.gp++;
  t.gs += b.starter ? 1 : 0;
  t.min += b.min;
  t.fgm += b.fgm; t.fga += b.fga; t.fg3m += b.fg3m; t.fg3a += b.fg3a; t.ftm += b.ftm; t.fta += b.fta;
  t.oreb += b.oreb; t.dreb += b.dreb; t.ast += b.ast; t.stl += b.stl; t.blk += b.blk; t.tov += b.tov; t.pf += b.pf; t.pts += b.pts; t.pm += b.pm;
  const reb = b.oreb + b.dreb;
  const cats = [b.pts, reb, b.ast, b.stl, b.blk].filter((v) => v >= 10).length;
  if (cats >= 2) t.dd++;
  if (cats >= 3) t.td++;
}

const RECORD_STATS: [string, (b: BoxLine) => number][] = [
  ["Points", (b) => b.pts],
  ["Rebounds", (b) => b.oreb + b.dreb],
  ["Assists", (b) => b.ast],
  ["Steals", (b) => b.stl],
  ["Blocks", (b) => b.blk],
  ["3-Pointers Made", (b) => b.fg3m],
];

export function recordBox(l: League, g: ScheduledGame, box: BoxScore, clutch: Record<string, { pts: number; secs: number; pm: number }>, keepBox: boolean) {
  const playoffs = g.type === "playoffs";
  const cup = g.type === "cup-group" || g.type === "cup-knockout" || g.type === "cup-final";
  const countsRegular = g.type === "regular" || g.type === "cup-group" || g.type === "cup-knockout";
  for (const [side, teamId, opp] of [["home", g.home, g.away], ["away", g.away, g.home]] as const) {
    for (const b of box.lines[side]) {
      if (b.min <= 0) continue;
      const s = seasonStatsFor(l, b.playerId, teamId);
      if (playoffs) addLine(s.playoffs, b);
      else if (countsRegular) addLine(s.regular, b);
      if (cup) addLine((s.cup ??= emptyLine()), b);
      const c = clutch[b.playerId];
      if (c && countsRegular) {
        s.regular.clutchPts += c.pts;
        s.regular.clutchMin += c.secs / 60;
        s.regular.clutchPm += c.pm;
      }
      if (countsRegular || playoffs) {
        (l.gameLog[b.playerId] ??= []).push({
          gameId: g.id, date: g.date, opp, home: side === "home", min: b.min, pts: b.pts, reb: b.oreb + b.dreb, ast: b.ast, stl: b.stl, blk: b.blk,
          fgm: b.fgm, fga: b.fga, fg3m: b.fg3m, fg3a: b.fg3a, ftm: b.ftm, fta: b.fta, tov: b.tov, pm: b.pm,
        });
        const p = l.players[b.playerId];
        for (const [stat, f] of RECORD_STATS) {
          const v = f(b);
          const rec = l.records.singleGame.find((r) => r.stat === stat);
          if (!rec || v > rec.value) {
            l.records.singleGame = l.records.singleGame.filter((r) => r.stat !== stat);
            l.records.singleGame.push({ stat, value: v, playerId: p.id, name: p.name, date: g.date, season: l.season, opp });
            if (rec && v >= 50 && stat === "Points") l.news.unshift({ id: `rec${g.id}`, date: g.date, type: "milestone", text: `${p.name} scores ${v} points - a new league single-game high in this save!`, teams: [teamId], players: [p.id], important: true });
          }
        }
        if (b.pts >= 50) l.news.unshift({ id: `m50${g.id}${p.id}`, date: g.date, type: "milestone", text: `${p.name} erupts for ${b.pts} points vs ${opp}.`, teams: [teamId], players: [p.id] });
        const reb = b.oreb + b.dreb;
        if ([b.pts, reb, b.ast].every((v) => v >= 10) && b.pts >= 25 && reb >= 12) l.news.unshift({ id: `td${g.id}${p.id}`, date: g.date, type: "milestone", text: `${p.name}: ${b.pts}-${reb}-${b.ast} triple-double vs ${opp}.`, teams: [teamId], players: [p.id] });
      }
    }
  }
  if (keepBox) l.boxScores[g.id] = box;
}

/** Per-game averages helper for UI and awards. */
export function perGame(s: StatLine) {
  const g = Math.max(1, s.gp);
  return {
    gp: s.gp, gs: s.gs, min: s.min / g, pts: s.pts / g, reb: (s.oreb + s.dreb) / g, ast: s.ast / g, stl: s.stl / g, blk: s.blk / g, tov: s.tov / g,
    fgPct: s.fga ? s.fgm / s.fga : 0, fg3Pct: s.fg3a ? s.fg3m / s.fg3a : 0, ftPct: s.fta ? s.ftm / s.fta : 0,
    ts: s.fga + 0.44 * s.fta > 0 ? s.pts / (2 * (s.fga + 0.44 * s.fta)) : 0, pm: s.pm / g,
  };
}

/** Combined regular-season line across teams for a season. */
export function seasonTotal(l: League, playerId: string, season = l.season, kind: "regular" | "playoffs" = "regular"): StatLine {
  const out = emptyLine();
  for (const s of l.players[playerId]?.stats ?? []) {
    if (s.season !== season) continue;
    const src = s[kind];
    for (const k of Object.keys(out) as (keyof StatLine)[]) out[k] += src[k];
  }
  return out;
}
