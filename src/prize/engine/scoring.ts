/**
 * The ten point must system. Three judges score every round on their own: the winner of a round gets 10 and the
 * loser 9; each knockdown takes a point from the boxer who went down (knockdowns on both sides cancel); a round
 * one boxer owned from bell to bell can be 10 8 without a knockdown; a round nobody won can be 10 10; points the
 * referee took away come off the round for every judge. Judges weigh clean punches, power, damage, aggression
 * and defence a little differently, and see a close round a little differently, which is where split and
 * majority decisions come from.
 */
import { gauss, next } from "./rng";
import type { Judge, Method, Result, RoundStats } from "./types";

export function emptyStats(): RoundStats {
  return { thrown: 0, landed: 0, jabsThrown: 0, jabsLanded: 0, powerThrown: 0, powerLanded: 0, headLanded: 0, bodyLanded: 0, damage: 0, kd: 0, blocked: 0, evaded: 0, forward: 0, ropes: 0, clinches: 0, deducted: 0 };
}

export function addStats(into: RoundStats, s: RoundStats) {
  for (const k of Object.keys(into) as (keyof RoundStats)[]) into[k] += s[k];
}

const JUDGE_NAMES = ["Dave Moretti", "Glenn Feldman", "Tim Cheatham", "Adalaide Byrd", "Steve Weisfeld", "Julie Lederman", "Max DeLuca", "Burt Clements", "Pat Russell", "Guido Cavalleri", "Howard Foster", "Ines Salgado"];

/** three judges with their own eye for a round */
export function makeJudges(rs: { rng: number }): Judge[] {
  const names = JUDGE_NAMES.slice();
  const out: Judge[] = [];
  for (let i = 0; i < 3; i++) {
    const k = Math.floor(next(rs) * names.length);
    const name = names.splice(k, 1)[0];
    out.push({
      name,
      wLanded: 1 + (next(rs) - 0.5) * 0.3,
      wPower: 0.7 + (next(rs) - 0.5) * 0.5,
      wDamage: 0.08 + (next(rs) - 0.5) * 0.05,
      wAggr: 0.06 + next(rs) * 0.1,
      wDef: 0.05 + next(rs) * 0.08,
      noise: 0.9 + next(rs) * 1.2,
      even: 0.15 + next(rs) * 0.45,
      dom: 2.3 + next(rs) * 0.8,
    });
  }
  return out;
}

/** how much a judge liked one boxer's round (before knockdowns) */
export function roundScore(j: Judge, me: RoundStats): number {
  return j.wLanded * me.landed + j.wPower * me.powerLanded + j.wDamage * me.damage + j.wAggr * me.forward + j.wDef * (me.evaded + me.blocked * 0.3);
}

/**
 * One judge's card for one round: [corner 0, corner 1]. The fighter with fewer knockdowns against him wins the
 * round outright; otherwise the judge's eye decides, with his own noise. Deductions come off afterwards.
 */
export function scoreRound(j: Judge, a: RoundStats, b: RoundStats, rs: { rng: number }): [number, number] {
  let pa = 10,
    pb = 10;
  const kdDiff = a.kd - b.kd;
  const sa = roundScore(j, a),
    sb = roundScore(j, b);
  // the noise grows a little with how busy the round was: a busy close round is harder to call
  const busy = Math.sqrt(1 + (a.landed + b.landed) / 12);
  const diff = sa - sb + gauss(rs) * j.noise * busy;
  if (kdDiff !== 0) {
    // the boxer who went down more loses the round: 10 8 for one knockdown in a round he lost anyway, 10 9 when
    // he was winning the punches until he went down, a point more for every extra knockdown
    const n = Math.abs(kdDiff);
    const downWonPunches = kdDiff > 0 ? diff > 0 : diff < 0;
    const lose = Math.max(6, (downWonPunches ? 10 : 9) - n);
    if (kdDiff > 0) pa = lose;
    else pb = lose;
  } else {
    if (Math.abs(diff) < j.even && a.landed + b.landed < 30) {
      pa = 10;
      pb = 10;
    } else if (diff > 0) {
      pb = 9;
      // a one sided round: 10 8 with no knockdown
      if (a.landed >= j.dom * Math.max(2, b.landed) && a.damage - b.damage > 28) pb = 8;
    } else {
      pa = 9;
      if (b.landed >= j.dom * Math.max(2, a.landed) && b.damage - a.damage > 28) pa = 8;
    }
  }
  pa -= a.deducted;
  pb -= b.deducted;
  return [pa, pb];
}

export function totals(card: [number, number][]): [number, number] {
  let a = 0,
    b = 0;
  for (const [x, y] of card) {
    a += x;
    b += y;
  }
  return [a, b];
}

/**
 * The decision from three cards. Unanimous: all three for one boxer. Split: two for one, one for the other.
 * Majority: two for one and one even. Draws: majority draw (two even), split draw (one each way and one even),
 * unanimous draw (all three even).
 */
export function decide(cards: [number, number][][]): { winner: 0 | 1 | null; method: Method; detail: string; totals: [number, number][] } {
  const t = cards.map(totals);
  let a = 0,
    b = 0,
    d = 0;
  for (const [x, y] of t) {
    if (x > y) a++;
    else if (y > x) b++;
    else d++;
  }
  if (a === 3) return { winner: 0, method: "UD", detail: "Unanimous decision", totals: t };
  if (b === 3) return { winner: 1, method: "UD", detail: "Unanimous decision", totals: t };
  if (a === 2 && b === 1) return { winner: 0, method: "SD", detail: "Split decision", totals: t };
  if (b === 2 && a === 1) return { winner: 1, method: "SD", detail: "Split decision", totals: t };
  if (a === 2 && d === 1) return { winner: 0, method: "MD", detail: "Majority decision", totals: t };
  if (b === 2 && d === 1) return { winner: 1, method: "MD", detail: "Majority decision", totals: t };
  if (d === 3) return { winner: null, method: "DRAW", detail: "Unanimous draw", totals: t };
  if (d === 2) return { winner: null, method: "DRAW", detail: "Majority draw", totals: t };
  return { winner: null, method: "DRAW", detail: "Split draw", totals: t };
}

/** the words for a decision result */
export function decisionResult(cards: [number, number][][], rounds: number, roundSec: number): Result {
  const d = decide(cards);
  return {
    winner: d.winner,
    method: d.method,
    detail: d.detail,
    how: d.detail,
    round: rounds,
    time: roundSec,
    totals: d.totals,
  };
}
