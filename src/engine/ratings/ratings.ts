/**
 * Core rating math shared by real and generated players.
 *
 * OVR FORMULA
 *   ovr = weighted mean of the 35 attributes with position-specific weights (PG / SF / C defined,
 *   SG and PF interpolated), blended 70/30 with the mean of the player's 6 best *weighted* skills so
 *   specialists aren't dragged down by irrelevant attributes. Result clamped to 25..99.
 *
 * CALIBRATION
 *   Attributes are first generated from signals (stats or archetype), then shifted uniformly
 *   (skills only; physical/size attributes are left alone) until ovrFromAttributes() == target OVR.
 */
import type { Attributes, AttributeKey, Personality, Position, Tendencies } from "../types/game";
import { ATTRIBUTE_KEYS } from "../types/game";
import { clamp, Rng } from "../util/rng";

type Weights = Partial<Record<AttributeKey, number>>;

const PG: Weights = {
  threePoint: 1.2, midRange: 0.8, closeShot: 0.4, layup: 1.0, freeThrow: 0.3, drawFoul: 0.6, shotIQ: 1.0,
  passAccuracy: 1.2, passVision: 1.2, passIQ: 1.0, ballHandle: 1.3, speedWithBall: 1.0,
  perimeterD: 1.0, steal: 0.6, helpDefIQ: 0.5, passPerception: 0.5, interiorD: 0.15, block: 0.1,
  defRebound: 0.2, offRebound: 0.1, speed: 0.8, acceleration: 0.8, strength: 0.2, vertical: 0.3,
  stamina: 0.3, hustle: 0.4, drivingDunk: 0.3, standingDunk: 0.05, postControl: 0.05, postHook: 0.02, postFade: 0.05,
  offConsistency: 0.6, defConsistency: 0.4, clutch: 0.4,
};
const SF: Weights = {
  threePoint: 1.1, midRange: 0.9, closeShot: 0.7, layup: 0.9, freeThrow: 0.3, drawFoul: 0.6, shotIQ: 1.0,
  passAccuracy: 0.6, passVision: 0.6, passIQ: 0.7, ballHandle: 0.8, speedWithBall: 0.7,
  perimeterD: 1.2, steal: 0.6, helpDefIQ: 0.7, passPerception: 0.5, interiorD: 0.5, block: 0.4,
  defRebound: 0.6, offRebound: 0.4, speed: 0.7, acceleration: 0.6, strength: 0.5, vertical: 0.5,
  stamina: 0.3, hustle: 0.5, drivingDunk: 0.6, standingDunk: 0.3, postControl: 0.3, postHook: 0.2, postFade: 0.3,
  offConsistency: 0.6, defConsistency: 0.5, clutch: 0.4,
};
const C: Weights = {
  threePoint: 0.45, midRange: 0.4, closeShot: 1.2, layup: 0.5, freeThrow: 0.3, drawFoul: 0.6, shotIQ: 0.8,
  passAccuracy: 0.4, passVision: 0.4, passIQ: 0.5, ballHandle: 0.2, speedWithBall: 0.15,
  perimeterD: 0.4, steal: 0.3, helpDefIQ: 1.0, passPerception: 0.3, interiorD: 1.4, block: 1.2,
  defRebound: 1.3, offRebound: 1.0, speed: 0.3, acceleration: 0.3, strength: 1.0, vertical: 0.6,
  stamina: 0.3, hustle: 0.5, drivingDunk: 0.3, standingDunk: 1.0, postControl: 0.8, postHook: 0.8, postFade: 0.4,
  offConsistency: 0.5, defConsistency: 0.5, clutch: 0.2,
};
const blend = (a: Weights, b: Weights): Weights => {
  const o: Weights = {};
  for (const k of ATTRIBUTE_KEYS) o[k] = ((a[k] ?? 0) + (b[k] ?? 0)) / 2;
  return o;
};
export const POSITION_WEIGHTS: Record<Position, Weights> = { PG, SG: blend(PG, SF), SF, PF: blend(SF, C), C };

/** Attributes that describe the body, not skill - calibration leaves them unchanged. */
export const PHYSICAL_KEYS: AttributeKey[] = ["speed", "acceleration", "strength", "vertical", "stamina", "durability"];

export function ovrFromAttributes(a: Attributes, pos: Position): number {
  const w = POSITION_WEIGHTS[pos];
  let tw = 0;
  let tv = 0;
  const contrib: { v: number; w: number }[] = [];
  for (const k of ATTRIBUTE_KEYS) {
    const wk = w[k] ?? 0;
    if (!wk) continue;
    tw += wk;
    tv += wk * a[k];
    if (wk >= 0.8) contrib.push({ v: a[k], w: wk });
  }
  const wavg = tv / tw;
  contrib.sort((x, y) => y.v - x.v);
  const top = contrib.slice(0, 6);
  const topAvg = top.reduce((s, c) => s + c.v, 0) / Math.max(1, top.length);
  // stretch so elite players reach the high 90s and replacement level sits in the 40s-50s
  const raw = 0.7 * wavg + 0.3 * topAvg;
  return Math.round(clamp(40 + (raw - 45) * 1.35, 25, 99));
}

/**
 * Shift skill attributes until the formula yields `target`. The shift is shape-preserving: a player's
 * strongest skills move ~1.7x the average and the weakest ~0.3x, so raising a star doesn't turn every
 * weakness into a strength.
 */
export function calibrate(a: Attributes, pos: Position, target: number, locked: AttributeKey[] = []): Attributes {
  const out = { ...a };
  const skills = ATTRIBUTE_KEYS.filter((k) => !PHYSICAL_KEYS.includes(k) && !locked.includes(k));
  for (let iter = 0; iter < 16; iter++) {
    const cur = ovrFromAttributes(out, pos);
    const diff = target - cur;
    if (diff === 0) break;
    const ranked = [...skills].sort((x, y) => out[x] - out[y]);
    const rankOf = new Map(ranked.map((k, i) => [k, i / (ranked.length - 1)]));
    const step = diff / 1.35;
    for (const k of skills) {
      const r = rankOf.get(k)!;
      const w = diff > 0 ? 0.3 + 1.4 * r : 1.7 - 1.4 * r; // raise strengths, lower weaknesses
      const moved = out[k] + step * w;
      out[k] = clamp(Math.round(Math.abs(step * w) < 0.5 ? out[k] + Math.sign(step) : moved), 25, 99);
    }
  }
  return out;
}

/** Expected growth by age used for potential and progression. */
export function expectedGrowth(age: number): number {
  const table: Record<number, number> = { 18: 16, 19: 14, 20: 12, 21: 10, 22: 8, 23: 6, 24: 4, 25: 2.5, 26: 1.2, 27: 0.5 };
  if (age <= 18) return 16;
  return table[age] ?? 0;
}

export function potentialFor(ovr: number, age: number, rng: Rng, pedigree = 0): number {
  const g = expectedGrowth(age);
  const pot = ovr + g + pedigree + (g > 0 ? rng.normal(0, 2.5) : 0);
  return Math.round(clamp(Math.max(ovr, pot), 30, 99));
}

// ---------- traits (original names) ----------
export interface TraitDef {
  id: string;
  label: string;
  description: string;
  test: (a: Attributes, ovr: number, age: number, t?: Tendencies) => boolean;
}

export const TRAITS: TraitDef[] = [
  { id: "laser", label: "Laser Range", description: "Elite catch-and-shoot 3s", test: (a) => a.threePoint >= 88 },
  { id: "tough-shot", label: "Tough Shotmaker", description: "Hits contested pull-ups", test: (a) => a.midRange >= 86 && a.shotIQ >= 80 },
  { id: "rim-wrecker", label: "Rim Wrecker", description: "Finishes through contact above the rim", test: (a) => Math.max(a.drivingDunk, a.standingDunk) >= 88 },
  { id: "crafty", label: "Crafty Finisher", description: "Creative finishes around the basket", test: (a) => a.layup >= 88 },
  { id: "post-craft", label: "Post Craftsman", description: "Footwork and touch on the block", test: (a) => a.postControl >= 82 && a.postHook >= 78 },
  { id: "foul-magnet", label: "Foul Magnet", description: "Draws whistles at a high rate", test: (a) => a.drawFoul >= 86 },
  { id: "metronome", label: "Metronome", description: "Automatic from the line", test: (a) => a.freeThrow >= 90 },
  { id: "floor-general", label: "Floor General", description: "Elevates teammates' shot quality", test: (a) => a.passVision >= 88 && a.passIQ >= 80 },
  { id: "handles", label: "String Theory", description: "Tight handle, rarely coughs it up", test: (a) => a.ballHandle >= 88 },
  { id: "lockdown", label: "Lockdown", description: "Shuts down perimeter scorers", test: (a) => a.perimeterD >= 86 },
  { id: "anchor", label: "Paint Anchor", description: "Deters shots at the rim", test: (a) => a.interiorD >= 86 && a.block >= 78 },
  { id: "pickpocket", label: "Pickpocket", description: "Generates live-ball turnovers", test: (a) => a.steal >= 86 },
  { id: "swat", label: "Swat Team", description: "Elite shot blocker", test: (a) => a.block >= 86 },
  { id: "glass", label: "Glass Eater", description: "Dominates the boards", test: (a) => Math.max(a.offRebound, a.defRebound) >= 88 },
  { id: "ice", label: "Ice Veins", description: "Better in the clutch", test: (a) => a.clutch >= 87 },
  { id: "iron", label: "Iron Frame", description: "Rarely misses games", test: (a) => a.durability >= 90 },
  { id: "motor", label: "Endless Motor", description: "Plays heavy minutes without fading", test: (a) => a.stamina >= 90 && a.hustle >= 80 },
  { id: "blur", label: "Transition Blur", description: "Lethal in the open floor", test: (a) => a.speed >= 88 && a.speedWithBall >= 80 },
  { id: "bruiser", label: "Bruiser", description: "Wins physical matchups", test: (a) => a.strength >= 88 },
  { id: "two-way", label: "Two-Way Force", description: "Impacts both ends", test: (a, ovr) => ovr >= 84 && a.perimeterD + a.interiorD >= 150 },
  { id: "microwave", label: "Microwave", description: "Instant offense off the bench", test: (a, ovr, _age, t) => ovr < 80 && (t?.usage ?? 0) >= 0.24 },
  { id: "vet", label: "Veteran Presence", description: "Steadies young rotations", test: (a, _ovr, age) => age >= 32 && a.passIQ + a.helpDefIQ >= 150 },
  { id: "glue", label: "Glue Guy", description: "Does the dirty work", test: (a, ovr) => ovr < 80 && a.hustle >= 85 },
];

export function traitsFor(a: Attributes, ovr: number, age: number, t?: Tendencies): string[] {
  return TRAITS.filter((d) => d.test(a, ovr, age, t)).map((d) => d.id).slice(0, 6);
}

export function traitLabel(id: string): string {
  return TRAITS.find((t) => t.id === id)?.label ?? id;
}

// ---------- personality ----------
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function personalityFor(id: string, age: number, ovr: number): Personality {
  const r = new Rng(hashString("persona:" + id));
  const n = (m: number, sd: number) => Math.round(clamp(r.normal(m, sd), 1, 99));
  return {
    loyalty: n(45 + Math.max(0, age - 28) * 2, 20),
    winning: n(50 + Math.max(0, age - 29) * 3 + (ovr >= 80 ? 8 : 0), 18),
    money: n(55 - Math.max(0, age - 32) * 3, 20),
    playTime: n(50 + (age < 26 ? 10 : 0), 18),
    workEthic: n(60, 18),
    ego: n(40 + (ovr >= 85 ? 20 : 0), 18),
  };
}

// ---------- tendencies from ratings (for players without stats) ----------
export function tendenciesFromRatings(a: Attributes, pos: Position, ovr: number): Tendencies {
  const bigness = pos === "C" ? 1 : pos === "PF" ? 0.7 : pos === "SF" ? 0.4 : pos === "SG" ? 0.2 : 0;
  return {
    usage: clamp(0.12 + (ovr - 50) * 0.0035 + (a.ballHandle - 60) * 0.0008, 0.1, 0.34),
    threeRate: clamp(0.05 + (a.threePoint - 40) * 0.0085 - bigness * 0.12, 0.0, 0.7),
    rimRate: clamp(0.35 + bigness * 0.3 + (a.drivingDunk - 60) * 0.004, 0.2, 0.9),
    ftRate: clamp(0.15 + (a.drawFoul - 50) * 0.004, 0.08, 0.5),
    astRate: clamp(0.05 + (a.passVision - 40) * 0.0035, 0.03, 0.45),
    tovRate: clamp(0.14 - (a.ballHandle - 50) * 0.0008, 0.07, 0.2),
    orebRate: clamp(0.02 + (a.offRebound - 40) * 0.0017, 0.01, 0.16),
    drebRate: clamp(0.08 + (a.defRebound - 40) * 0.0028, 0.05, 0.32),
    stlRate: clamp(0.008 + (a.steal - 40) * 0.00025, 0.005, 0.03),
    blkRate: clamp(0.004 + (a.block - 40) * 0.0005, 0.002, 0.06),
    foulRate: 0.045,
  };
}
