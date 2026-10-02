/**
 * ORIGINAL RATINGS FROM REAL STATS - documented formula
 * ======================================================
 * 1. Blend the last three seasons with recency weights 0.55 / 0.30 / 0.15 (× minutes played).
 *    Shooting percentages are regressed to league means by attempts:
 *      3P% prior .355 (k=80 att) · 2P% prior .540 (k=120) · FT% prior .780 (k=40).
 * 2. IMPACT (target OVR): z-score composite of
 *      0.36 × box production per 36  (Game-Score-style: PTS + .4FGM − .7FGA − .4FTmiss + .7OREB + .3DREB
 *                                      + STL + .7AST + .7BLK − .4PF − TOV)
 *      0.24 × minutes per game        (coach trust)
 *      0.20 × points per game          (scoring volume)
 *      0.10 × true-shooting above average × usage
 *      0.10 × defensive activity per 36 (STL + BLK + .3 DREB) - box scores undervalue defense
 *    ranked league-wide and mapped through an anchor table (rank 1 → 99, 10 → 95, 20 → 91, 35 → 88,
 *    60 → 85, 90 → 83, 130 → 80, 180 → 78, 250 → 75, 420 → 68, last → 56).
 *    Reliability r = min(1, total minutes over the 3 seasons / 1500) blends that with a draft/age prior.
 * 2b. OVERRIDES: data/ratingOverrides.json pins specific players' OVR (name → value).
 * 3. ATTRIBUTES: each of the 35 attributes is a z-score composite of stat signals and physicals
 *    (see SIGNALS below) converted to a league percentile and mapped to 30..96, then calibrated
 *    (ratings.ts) so the OVR formula reproduces the impact target. Shooting is absolute, not relative:
 *      FT  = 25 + (FT% − .45) × 150
 *      3PT = 25 + (3P% − .25) × 330 × vol + 18 × vol,   vol = min(1.1, √((3PA/36 + .1) / 7))
 * 4. POTENTIAL = OVR + age growth curve (+ pedigree for top-10 picks ≤ 23) + noise.
 * 5. TENDENCIES are read straight from the blended stats so simulated box scores mirror real profiles.
 */
import type { SeedPlayer } from "../types/seed";
import type { Attributes, AttributeKey, Personality, Position, Tendencies } from "../types/game";
import { ATTRIBUTE_KEYS } from "../types/game";
import { clamp, Rng } from "../util/rng";
import { calibrate, hashString, ovrFromAttributes, personalityFor, potentialFor, tendenciesFromRatings, traitsFor } from "./ratings";
import { archetypeAttributes } from "./generate";
import { assignPositions } from "../league/positions";

export interface RatedPlayer {
  pos: Position;
  ratings: Attributes;
  ovr: number;
  pot: number;
  tendencies: Tendencies;
  traits: string[];
  personality: Personality;
  reliability: number;
}

interface Blend {
  min: number; // weighted minutes
  mpg: number;
  gpShare: number;
  per36: Record<string, number>;
  fg3p: number;
  fg2p: number;
  ftp: number;
  ts: number;
  threeRate: number;
  ftRate: number;
  usage: number;
}

const W = [0.55, 0.3, 0.15];
const WIN_W = Number(process.env.FO_WIN ?? 0.4);

function blendStats(p: SeedPlayer): Blend {
  const keys = ["fgm", "fga", "fg3m", "fg3a", "ftm", "fta", "oreb", "dreb", "reb", "ast", "stl", "blk", "tov", "pf", "pts"] as const;
  const acc: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  let min = 0;
  let gp = 0;
  let wsum = 0;
  let gpPossible = 0;
  p.stats.forEach((s, i) => {
    const w = W[i] ?? 0.1;
    for (const k of keys) acc[k] += w * s[k];
    min += w * s.min;
    gp += w * s.gp;
    gpPossible += w * 82;
    wsum += w;
  });
  const per36: Record<string, number> = {};
  for (const k of keys) per36[k] = min > 0 ? (36 * acc[k]) / min : 0;
  const fg2a = acc.fga - acc.fg3a;
  const fg2m = acc.fgm - acc.fg3m;
  const fg3p = (acc.fg3m + 0.355 * 80) / (acc.fg3a + 80);
  const fg2p = (fg2m + 0.54 * 120) / (fg2a + 120);
  const ftp = (acc.ftm + 0.78 * 40) / (acc.fta + 40);
  const tsa = acc.fga + 0.44 * acc.fta;
  const ts = tsa > 0 ? (acc.pts + 0.58 * 2 * 60) / (2 * (tsa + 60)) : 0.56;
  return {
    min,
    mpg: gp > 0 ? min / gp : 0,
    gpShare: gpPossible > 0 ? gp / gpPossible : 0,
    per36,
    fg3p,
    fg2p,
    ftp,
    ts,
    threeRate: acc.fga > 0 ? acc.fg3a / acc.fga : 0.3,
    ftRate: acc.fga > 0 ? acc.fta / acc.fga : 0.2,
    usage: (per36.fga + 0.44 * per36.fta + per36.tov) / 75,
  };
}

export function primaryPosition(p: SeedPlayer, b: Blend | null): Position {
  const pos = p.positions.join("-").toUpperCase();
  const ast = b?.per36.ast ?? 0;
  const h = p.heightIn;
  if (["PG", "SG", "SF", "PF", "C"].includes(pos)) return pos as Position;
  if (pos === "C") return "C";
  if (pos.startsWith("G") && pos.includes("F")) return h >= 79 ? "SF" : "SG";
  if (pos.startsWith("F") && pos.includes("C")) return h >= 83 ? "C" : "PF";
  if (pos.startsWith("F") && pos.includes("G")) return "SF";
  if (pos.startsWith("G")) return ast >= 5.5 || h <= 75 ? "PG" : "SG";
  if (pos.startsWith("F")) return h >= 81 || (b && b.threeRate < 0.3 && (b.per36.reb ?? 0) > 8) ? "PF" : "SF";
  return h >= 83 ? "C" : h >= 80 ? "PF" : h >= 78 ? "SF" : h >= 76 ? "SG" : "PG";
}

/** Anchor table: league rank -> OVR */
// video-game-style scale: top 10 ≥ 95, top 20 ≥ 91, good starters 85-88, rotation 78-83, fringe high 60s
const ANCHORS: [number, number][] = [[1, 99], [4, 98], [10, 95], [20, 91], [35, 88], [60, 85], [90, 83], [130, 80], [180, 78], [250, 75], [330, 72], [420, 68], [520, 63], [700, 56]];
export function ovrForRank(rank: number): number {
  for (let i = 1; i < ANCHORS.length; i++) {
    const [r1, o1] = ANCHORS[i - 1];
    const [r2, o2] = ANCHORS[i];
    if (rank <= r2) return o1 + ((rank - r1) / (r2 - r1)) * (o2 - o1);
  }
  return 45;
}

function priorOvr(p: SeedPlayer): number {
  // players with little NBA data: draft slot & age
  if (p.draft && p.draft.round === 1) return clamp(71 - (p.draft.pick - 1) * 0.42 - Math.max(0, p.age - 20) * 0.6, 55, 72);
  if (p.draft && p.draft.round === 2) return clamp(57 - (p.draft.pick - 31) * 0.1, 50, 58);
  return clamp(55 - Math.max(0, p.age - 25) * 0.5, 47, 57);
}

type Sig = Partial<Record<string, number>>; // signal name -> weight

// z-score composites; negative weight = lower is better
const SIGNALS: Record<AttributeKey, Sig> = {
  closeShot: { fg2p: 0.5, height: 0.25, oreb: 0.25 },
  midRange: { ftp: 0.5, fg2p: 0.25, three: 0.25 },
  threePoint: { three: 1 },
  freeThrow: { ftp: 1 },
  layup: { fg2p: 0.4, ftRate: 0.3, light: 0.3 },
  standingDunk: { height: 0.5, blk: 0.25, oreb: 0.25 },
  drivingDunk: { athletic: 0.5, ftRate: 0.3, height: 0.2 },
  postHook: { height: 0.4, fg2p: 0.3, inside: 0.3 },
  postFade: { height: 0.3, ftp: 0.3, inside: 0.2, usage: 0.2 },
  postControl: { height: 0.3, inside: 0.3, usage: 0.2, weight: 0.2 },
  drawFoul: { ftRate: 0.7, usage: 0.3 },
  shotIQ: { ts: 0.7, exp: 0.3 },
  passAccuracy: { ast: 0.5, astTo: 0.5 },
  passVision: { ast: 0.85, usage: 0.15 },
  passIQ: { astTo: 0.6, exp: 0.4 },
  ballHandle: { ast: 0.4, lowTov: 0.2, usage: 0.2, small: 0.2 },
  speedWithBall: { light: 0.4, ast: 0.3, ftRate: 0.3 },
  interiorD: { blk: 0.4, dreb: 0.3, height: 0.3 },
  perimeterD: { stl: 0.45, mpg: 0.3, light: 0.25 },
  steal: { stl: 1 },
  block: { blk: 0.8, height: 0.2 },
  helpDefIQ: { stocks: 0.4, exp: 0.3, mpg: 0.3 },
  passPerception: { stl: 0.7, exp: 0.3 },
  offRebound: { oreb: 1 },
  defRebound: { dreb: 1 },
  speed: { light: 0.6, small: 0.2, stl: 0.2 },
  acceleration: { light: 0.5, small: 0.3, stl: 0.2 },
  strength: { weight: 0.8, oreb: 0.2 },
  vertical: { blk: 0.35, oreb: 0.2, athletic: 0.45 },
  stamina: { mpg: 0.8, young: 0.2 },
  durability: { gpShare: 0.7, young: 0.3 },
  hustle: { oreb: 0.25, stl: 0.25, mpg: 0.5 },
  offConsistency: { ts: 0.5, exp: 0.5 },
  defConsistency: { exp: 0.5, stocks: 0.5 },
  clutch: { usage: 0.4, ftp: 0.3, exp: 0.3 },
};

function rawSignals(p: SeedPlayer, b: Blend): Record<string, number> {
  const x = b.per36;
  return {
    fg2p: b.fg2p,
    ftp: b.ftp,
    three: (b.fg3p - 0.3) * Math.min(1, (x.fg3a + 0.3) / 5),
    ftRate: b.ftRate,
    ts: b.ts * Math.sqrt(Math.max(0.08, b.usage)),
    usage: b.usage,
    ast: x.ast,
    astTo: x.ast / Math.max(0.6, x.tov),
    lowTov: -x.tov / Math.max(1, x.fga + 0.44 * x.fta + x.tov),
    stl: x.stl,
    blk: x.blk,
    stocks: x.stl + x.blk,
    oreb: x.oreb,
    dreb: x.dreb,
    mpg: b.mpg,
    gpShare: b.gpShare,
    height: p.heightIn,
    small: -p.heightIn,
    weight: p.weightLb,
    light: -(p.weightLb / p.heightIn),
    athletic: -(p.weightLb / p.heightIn) + x.blk * 0.5 + x.oreb * 0.3,
    inside: -b.threeRate,
    exp: Math.min(12, p.experienceYears),
    young: -Math.abs(p.age - 25),
  };
}

function zScores(values: number[]): number[] {
  const n = values.length;
  const m = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / n) || 1;
  return values.map((v) => (v - m) / sd);
}

function percentileRanks(values: number[]): number[] {
  const idx = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(values.length);
  idx.forEach(([, i], r) => (out[i] = values.length > 1 ? r / (values.length - 1) : 0.5));
  return out;
}

function tendenciesFromBlend(b: Blend): Tendencies {
  const x = b.per36;
  const fg2a = Math.max(0.1, x.fga - x.fg3a);
  return {
    usage: clamp(b.usage, 0.08, 0.38),
    threeRate: clamp(b.threeRate, 0, 0.85),
    rimRate: clamp(0.45 + (b.fg2p - 0.52) * 2.2 + (x.oreb / fg2a) * 0.3, 0.2, 0.92),
    ftRate: clamp(b.ftRate, 0.04, 0.7),
    astRate: clamp(x.ast / Math.max(12, 31 - x.fgm), 0.02, 0.5),
    tovRate: clamp(x.tov / Math.max(1, x.fga + 0.44 * x.fta + x.tov), 0.05, 0.25),
    orebRate: clamp(x.oreb / 35, 0.005, 0.18),
    drebRate: clamp(x.dreb / 35, 0.04, 0.35),
    stlRate: clamp(x.stl / 75, 0.004, 0.035),
    blkRate: clamp(x.blk / 37, 0.001, 0.12),
    foulRate: clamp(x.pf / 75, 0.02, 0.08),
  };
}

/** Rate every seeded player at once (percentiles are league-relative). */
/** teamWinPct: last season's win % by team id - players who logged big minutes on winning teams rate higher */
export function rateSeedPlayers(players: SeedPlayer[], overrides: Record<string, number> = {}, teamWinPct: Record<string, number> = {}): Map<string, RatedPlayer> {
  if (!players.length) return new Map();
  const blends = players.map((p) => (p.stats.length ? blendStats(p) : null));
  const totalMin = players.map((p) => p.stats.reduce((a, x) => a + x.min, 0));
  const reliab = blends.map((b, i) => (b ? clamp(totalMin[i] / 1500, 0, 1) : 0));

  // ---- impact -> target OVR (players with some data) ----
  const withData = players.map((_, i) => i).filter((i) => blends[i] && blends[i]!.min >= 60);
  const gs = withData.map((i) => {
    const x = blends[i]!.per36;
    return x.pts + 0.4 * x.fgm - 0.7 * x.fga - 0.4 * (x.fta - x.ftm) + 0.7 * x.oreb + 0.3 * x.dreb + x.stl + 0.7 * x.ast + 0.7 * x.blk - 0.4 * x.pf - x.tov;
  });
  const mpg = withData.map((i) => blends[i]!.mpg);
  const ppg = withData.map((i) => (blends[i]!.per36.pts * blends[i]!.mpg) / 36);
  const eff = withData.map((i) => (blends[i]!.ts - 0.57) * blends[i]!.usage * 100);
  const def = withData.map((i) => { const x = blends[i]!.per36; return x.stl + x.blk + 0.3 * x.dreb; });
  const zg = zScores(gs);
  const zm = zScores(mpg);
  const ze = zScores(eff);
  const zd = zScores(def);
  const zp = zScores(ppg);
  // winning impact (box scores miss it): minutes share on last season's team × how good that team was,
  // plus a smaller share from the season before
  const win = withData.map((i) => {
    let v = 0;
    players[i].stats.slice(0, 2).forEach((s, j) => {
      const wp = teamWinPct[s.team];
      if (wp == null) return;
      v += (j === 0 ? 1 : 0.35) * (wp - 0.5) * Math.min(1, s.min / (82 * 34));
    });
    return v;
  });
  const zw = zScores(win);
  // low-reliability production is shrunk toward 0 so tiny samples don't rank as stars
  const composite = withData.map((i, k) => (0.36 * zg[k] + 0.24 * zm[k] + 0.2 * zp[k] + 0.1 * ze[k] + 0.1 * zd[k] + WIN_W * zw[k]) * (0.35 + 0.65 * reliab[i]));
  const order = composite.map((c, k) => [c, withData[k]] as const).sort((a, b) => b[0] - a[0]);
  const dataOvr = new Map<number, number>();
  order.forEach(([, i], rank) => dataOvr.set(i, ovrForRank(rank + 1)));

  // ---- attribute signals (percentiles across players with data) ----
  const sigNames = Object.keys(rawSignals(players[0], blends.find(Boolean) ?? blendStats(players[0])));
  const sigMatrix: Record<string, number[]> = {};
  for (const s of sigNames) sigMatrix[s] = [];
  const dataIdx = players.map((_, i) => i).filter((i) => blends[i]);
  for (const i of dataIdx) {
    const r = rawSignals(players[i], blends[i]!);
    for (const s of sigNames) sigMatrix[s].push(r[s]);
  }
  const sigZ: Record<string, number[]> = {};
  for (const s of sigNames) sigZ[s] = zScores(sigMatrix[s]);
  const attrPct: Record<AttributeKey, number[]> = {} as Record<AttributeKey, number[]>;
  for (const k of ATTRIBUTE_KEYS) {
    const comp = dataIdx.map((_, j) => Object.entries(SIGNALS[k]).reduce((acc, [s, w]) => acc + (w ?? 0) * sigZ[s][j], 0));
    attrPct[k] = percentileRanks(comp);
  }
  const rowOf = new Map(dataIdx.map((i, j) => [i, j]));

  // positions: split each ESPN group (G / F / C) league-wide by positional score
  const DEFAULT_T: Tendencies = { usage: 0.18, threeRate: 0.35, rimRate: 0.5, ftRate: 0.22, astRate: 0.14, tovRate: 0.12, orebRate: 0.05, drebRate: 0.15, stlRate: 0.015, blkRate: 0.015, foulRate: 0.045 };
  const posOf = assignPositions(
    players.map((p, i) => {
      const b = blends[i];
      return { id: p.id, heightIn: p.heightIn, positions: p.positions, pos: primaryPosition(p, b), tendencies: b && b.min >= 150 ? tendenciesFromBlend(b) : DEFAULT_T };
    }),
  );

  const out = new Map<string, RatedPlayer>();
  players.forEach((p, i) => {
    const b = blends[i];
    const pos = posOf.get(p.id) ?? primaryPosition(p, b);
    const rng = new Rng(hashString("rate:" + p.id));
    const r = reliab[i];
    const prior = priorOvr(p);
    const pinned = typeof overrides[p.name] === "number" ? overrides[p.name] : null;
    const target = pinned ?? Math.round(dataOvr.has(i) ? r * dataOvr.get(i)! + (1 - r) * Math.max(prior, dataOvr.get(i)! - 4) : prior);

    // archetype attributes provide the shape for low-data players and physicals
    const arch = archetypeAttributes(rng, pos, p.heightIn, p.weightLb, target);
    let attrs: Attributes;
    const row = rowOf.get(i);
    if (row != null) {
      attrs = {} as Attributes;
      for (const k of ATTRIBUTE_KEYS) {
        const fromStats = 30 + 66 * Math.pow(attrPct[k][row], 0.9);
        attrs[k] = Math.round(r * fromStats + (1 - r) * arch[k]);
      }
      const bl = b!;
      const vol = Math.min(1.1, Math.sqrt((bl.per36.fg3a + 0.1) / 7));
      const three = clamp(25 + (bl.fg3p - 0.25) * 330 * vol + 18 * vol, 25, 99);
      const ft = clamp(25 + (bl.ftp - 0.45) * 150, 25, 99);
      attrs.threePoint = Math.round(r * three + (1 - r) * arch.threePoint);
      attrs.freeThrow = Math.round(r * ft + (1 - r) * arch.freeThrow);
    } else attrs = arch;
    // measured shooting is kept as-is (only when the sample is meaningful)
    attrs = calibrate(attrs, pos, clamp(target, 40, 99), r >= 0.5 ? ["threePoint", "freeThrow"] : []);
    const ovr = ovrFromAttributes(attrs, pos);
    const pedigree = p.draft && p.draft.round === 1 && p.draft.pick <= 10 && p.age <= 23 ? 2 : 0;
    const pot = potentialFor(ovr, p.age, rng, pedigree);
    const tend = b && b.min >= 150 ? blendTendencies(tendenciesFromBlend(b), tendenciesFromRatings(attrs, pos, ovr), r) : tendenciesFromRatings(attrs, pos, ovr);
    out.set(p.id, {
      pos,
      ratings: attrs,
      ovr,
      pot,
      tendencies: tend,
      traits: traitsFor(attrs, ovr, p.age, tend),
      personality: personalityFor(p.id, p.age, ovr),
      reliability: r,
    });
  });
  return out;
}

function blendTendencies(a: Tendencies, b: Tendencies, r: number): Tendencies {
  const o = {} as Tendencies;
  for (const k of Object.keys(a) as (keyof Tendencies)[]) o[k] = a[k] * r + b[k] * (1 - r);
  return o;
}
