/**
 * Advanced stats (original, documented estimates - not official formulas):
 *  TS%   = PTS / (2 × (FGA + 0.44 FTA))
 *  eFG%  = (FGM + 0.5 × 3PM) / FGA
 *  PER*  = 15 × (Game Score per 36) / (league minute-weighted Game Score per 36)
 *  BPM*  = league-normalised box composite per 36:
 *          .86 PTS + .39 REB + .73 AST + 1.6 STL + 1.2 BLK − 1.2 TOV − .72 missed FG − .35 missed FT
 *          (minus league average, scaled so 1 SD ≈ 3.5; ≥ 250 minutes)
 *  WS*   = max(−1, (BPM* + 3) × MIN / 2200);  WS/48 = WS × 48 / MIN
 */
import type { League, StatLine } from "../types/game";
import { seasonTotal } from "../season/stats";

export interface Advanced {
  ts: number;
  efg: number;
  per: number;
  bpm: number;
  ws: number;
  ws48: number;
  usg: number;
}

const gameScore = (s: StatLine) => s.pts + 0.4 * s.fgm - 0.7 * s.fga - 0.4 * (s.fta - s.ftm) + 0.7 * s.oreb + 0.3 * s.dreb + s.stl + 0.7 * s.ast + 0.7 * s.blk - 0.4 * s.pf - s.tov;
const boxComp = (s: StatLine) => 0.86 * s.pts + 0.39 * (s.oreb + s.dreb) + 0.73 * s.ast + 1.6 * s.stl + 1.2 * s.blk - 1.2 * s.tov - 0.72 * (s.fga - s.fgm) - 0.35 * (s.fta - s.ftm);

export interface LeagueBaselines {
  gs36: number;
  box36: number;
  boxSd: number;
}

export function leagueBaselines(l: League, season = l.season, kind: "regular" | "playoffs" = "regular"): LeagueBaselines {
  let gsSum = 0;
  let boxSum = 0;
  let minSum = 0;
  const vals: { v: number; m: number }[] = [];
  for (const id in l.players) {
    const s = seasonTotal(l, id, season, kind);
    if (s.min < 50) continue;
    gsSum += gameScore(s);
    boxSum += boxComp(s);
    minSum += s.min;
    if (s.min >= 250) vals.push({ v: (boxComp(s) * 36) / s.min, m: s.min });
  }
  const gs36 = minSum ? (gsSum * 36) / minSum : 12;
  const box36 = minSum ? (boxSum * 36) / minSum : 14;
  const mw = vals.reduce((a, x) => a + x.m, 0) || 1;
  const sd = Math.sqrt(vals.reduce((a, x) => a + x.m * (x.v - box36) ** 2, 0) / mw) || 5;
  return { gs36, box36, boxSd: sd };
}

export function advancedFor(s: StatLine, base: LeagueBaselines): Advanced {
  const ts = s.fga + 0.44 * s.fta > 0 ? s.pts / (2 * (s.fga + 0.44 * s.fta)) : 0;
  const efg = s.fga ? (s.fgm + 0.5 * s.fg3m) / s.fga : 0;
  if (s.min <= 0) return { ts, efg, per: 0, bpm: 0, ws: 0, ws48: 0, usg: 0 };
  const per = (15 * ((gameScore(s) * 36) / s.min)) / Math.max(1, base.gs36);
  const bpm = s.min >= 100 ? (((boxComp(s) * 36) / s.min - base.box36) / base.boxSd) * 3.5 : 0;
  const ws = Math.max(-1, ((bpm + 3) * s.min) / 2200);
  const usg = ((s.fga + 0.44 * s.fta + s.tov) * 36) / s.min / 75;
  return { ts, efg, per, bpm, ws, ws48: (ws * 48) / s.min, usg };
}
