/** Archetype-based attribute generation for players without stats (draft prospects, low-minute players). */
import type { Attributes, AttributeKey, Position } from "../types/game";
import { ATTRIBUTE_KEYS } from "../types/game";
import { clamp, Rng } from "../util/rng";
import { calibrate } from "./ratings";

/** Offsets from the player's base level by position (+ = relative strength). */
const SHAPE: Record<Position, Partial<Record<AttributeKey, number>>> = {
  PG: { threePoint: 6, midRange: 4, layup: 5, passAccuracy: 12, passVision: 14, passIQ: 10, ballHandle: 15, speedWithBall: 12, perimeterD: 2, steal: 5, speed: 12, acceleration: 12, interiorD: -20, block: -22, offRebound: -20, defRebound: -14, strength: -14, standingDunk: -25, postHook: -25, postFade: -12, postControl: -18, closeShot: -4 },
  SG: { threePoint: 9, midRange: 6, layup: 4, passAccuracy: 2, passVision: 2, ballHandle: 6, speedWithBall: 6, perimeterD: 4, steal: 3, speed: 8, acceleration: 8, interiorD: -15, block: -16, offRebound: -14, defRebound: -10, strength: -8, standingDunk: -18, postHook: -20, postControl: -12 },
  SF: { threePoint: 4, midRange: 3, layup: 3, perimeterD: 6, drivingDunk: 4, speed: 3, acceleration: 3, interiorD: -4, block: -5, offRebound: -4, defRebound: -2, standingDunk: -6, postHook: -8 },
  PF: { threePoint: -3, closeShot: 5, standingDunk: 6, interiorD: 6, block: 4, offRebound: 6, defRebound: 8, strength: 7, postHook: 3, postControl: 4, passVision: -6, ballHandle: -8, speedWithBall: -8, speed: -4, perimeterD: -3 },
  C: { threePoint: -12, midRange: -6, closeShot: 10, standingDunk: 12, interiorD: 14, block: 12, offRebound: 14, defRebound: 15, strength: 14, postHook: 8, postControl: 8, passVision: -10, ballHandle: -18, speedWithBall: -18, speed: -12, acceleration: -12, perimeterD: -10, steal: -6 },
};

export function archetypeAttributes(rng: Rng, pos: Position, heightIn: number, weightLb: number, target: number): Attributes {
  const base = clamp(target - 8, 30, 88);
  const shape = SHAPE[pos];
  const bmi = weightLb / heightIn;
  const a = {} as Attributes;
  // each player gets 2-3 random "specialties" so generated players aren't clones
  const specialties = new Set<AttributeKey>();
  while (specialties.size < 3) specialties.add(rng.pick(ATTRIBUTE_KEYS));
  for (const k of ATTRIBUTE_KEYS) {
    let v = base + (shape[k] ?? 0) + rng.normal(0, 6);
    if (specialties.has(k)) v += rng.range(6, 14);
    a[k] = Math.round(clamp(v, 25, 97));
  }
  // physicals from the body
  a.strength = Math.round(clamp(40 + (bmi - 2.6) * 55 + rng.normal(0, 5), 25, 97));
  a.speed = Math.round(clamp(92 - (heightIn - 72) * 1.6 - (bmi - 2.6) * 25 + rng.normal(0, 6), 25, 97));
  a.acceleration = Math.round(clamp(a.speed + rng.normal(0, 4), 25, 97));
  a.vertical = Math.round(clamp(72 - (bmi - 2.7) * 30 + rng.normal(0, 9), 25, 97));
  a.stamina = Math.round(clamp(70 + rng.normal(0, 8), 40, 97));
  a.durability = Math.round(clamp(72 + rng.normal(0, 10), 35, 97));
  return a;
}

export function generateAttributes(rng: Rng, pos: Position, heightIn: number, weightLb: number, target: number): Attributes {
  return calibrate(archetypeAttributes(rng, pos, heightIn, weightLb, target), pos, target);
}

export function randomBody(rng: Rng, pos: Position): { heightIn: number; weightLb: number } {
  const h: Record<Position, [number, number]> = { PG: [74, 2], SG: [77, 1.5], SF: [79, 1.5], PF: [81, 1.3], C: [83.5, 1.5] };
  const [m, sd] = h[pos];
  const heightIn = Math.round(clamp(rng.normal(m, sd), 70, 89));
  const weightLb = Math.round(clamp(heightIn * rng.normal(2.72, 0.12), 165, 300));
  return { heightIn, weightLb };
}
