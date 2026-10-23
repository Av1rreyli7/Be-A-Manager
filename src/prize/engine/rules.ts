/**
 * The numbers behind the fight: punch timings, ranges, damage, guard coverage, evade windows, traits. All in one
 * place so tuning never means hunting through the engine. Frames are at 60 steps a second.
 */
import type { Guard, PunchKind, Side, Stance, Trait, Tier } from "./types";

export const HZ = 60;
export const DT = 1 / HZ;

/** the ring inside the ropes: a square from -RING to RING on x and z, in metres (a 20 foot ring) */
export const RING = 3.05;
/** how close a body gets to the ropes, and how close two bodies get to each other */
export const BODY_R = 0.34;
/** how much of a punch's impact comes off head and body health, and how much turns into stun */
export const HEAD_K = 0.36;
export const BODY_K = 0.3;
export const STUN_K = 1.0;
export const MIN_GAP = 0.56;

export interface PunchSpec {
  hand: "lead" | "rear";
  /** frames of wind up, contact and recovery at speed 70 */
  startup: number;
  active: number;
  recovery: number;
  /** damage at power 50, before everything else */
  dmg: number;
  /** stamina it costs */
  cost: number;
  /** reach as a share of the boxer's own range, the closest it works well, where it is at its best */
  reach: number;
  jam: number;
  sweet: number;
  /** a power punch (everything but the jab) */
  power: boolean;
  /** hooks come round the side, uppercuts up the middle, straights down the middle */
  path: "straight" | "hook" | "upper";
}

export const PUNCH: Record<PunchKind, PunchSpec> = {
  jab: { hand: "lead", startup: 6, active: 3, recovery: 10, dmg: 2.4, cost: 1.5, reach: 1.0, jam: 0.6, sweet: 0.75, power: false, path: "straight" },
  cross: { hand: "rear", startup: 10, active: 3, recovery: 14, dmg: 5.0, cost: 3.1, reach: 1.0, jam: 0.58, sweet: 0.76, power: true, path: "straight" },
  lhook: { hand: "lead", startup: 11, active: 3, recovery: 15, dmg: 5.4, cost: 3.5, reach: 0.8, jam: 0.3, sweet: 0.45, power: true, path: "hook" },
  rhook: { hand: "rear", startup: 13, active: 3, recovery: 17, dmg: 6.6, cost: 4.1, reach: 0.8, jam: 0.3, sweet: 0.45, power: true, path: "hook" },
  lupper: { hand: "lead", startup: 11, active: 3, recovery: 16, dmg: 5.6, cost: 3.7, reach: 0.66, jam: 0.14, sweet: 0.3, power: true, path: "upper" },
  rupper: { hand: "rear", startup: 14, active: 3, recovery: 18, dmg: 7.0, cost: 4.5, reach: 0.66, jam: 0.14, sweet: 0.3, power: true, path: "upper" },
};
export const KINDS: PunchKind[] = ["jab", "cross", "lhook", "rhook", "lupper", "rupper"];

export const PUNCH_NAME: Record<PunchKind, string> = {
  jab: "Jab",
  cross: "Cross",
  lhook: "Lead hook",
  rhook: "Rear hook",
  lupper: "Lead uppercut",
  rupper: "Rear uppercut",
};

/** the hand a boxer throws a punch with, in the boxer's own frame */
export function handOf(kind: PunchKind, stance: Stance): Side {
  const lead: Side = stance === "orthodox" ? "L" : "R";
  return PUNCH[kind].hand === "lead" ? lead : lead === "L" ? "R" : "L";
}

/** the boxer's range in metres, centre to centre, at which a jab just reaches the chin (72 inches is 1.07 m) */
export function rangeOf(reachIn: number): number {
  return 1.07 + (reachIn - 72) * 0.0254 * 0.85;
}

/**
 * Guard coverage: the share of a punch the guard takes, by zone. "lead" and "rear" are the side of the defender
 * a punch lands on (the defender's lead or rear side), "center" is up the middle (uppercuts). Straights to the
 * head use the side and the centre half and half.
 *  HIGH: strong against everything to the head, the body is wide open, and blocking costs stamina.
 *  PHILLY: the lead shoulder takes punches on the lead side (crosses and rear hooks when stances match) and a
 *          timed roll takes all of it; the lead arm across the belly covers that side of the body; the rear side
 *          and the uppercut are open.
 *  NORMAL: middle of the road everywhere.
 */
export const COVER: Record<Guard, { head: { lead: number; rear: number; center: number }; body: { lead: number; rear: number; center: number }; drain: number }> = {
  high: { head: { lead: 0.86, rear: 0.86, center: 0.5 }, body: { lead: 0.08, rear: 0.08, center: 0.12 }, drain: 0.55 },
  philly: { head: { lead: 0.74, rear: 0.36, center: 0.2 }, body: { lead: 0.66, rear: 0.14, center: 0.3 }, drain: 0.2 },
  normal: { head: { lead: 0.62, rear: 0.62, center: 0.42 }, body: { lead: 0.5, rear: 0.5, center: 0.45 }, drain: 0.3 },
};
/** body shots against a high guard land a little harder: the elbows are up */
export const HIGH_BODY_BONUS = 1.1;

/** evade timing, in frames at speed 70: total length, full window start and end, perfect read window end */
export const EVADE: Record<string, { dur: number; w0: number; w1: number; wp: number; cost: number }> = {
  slipL: { dur: 24, w0: 3, w1: 16, wp: 10, cost: 1.2 },
  slipR: { dur: 24, w0: 3, w1: 16, wp: 10, cost: 1.2 },
  duck: { dur: 28, w0: 4, w1: 20, wp: 11, cost: 1.6 },
  back: { dur: 24, w0: 3, w1: 17, wp: 10, cost: 1.1 },
  roll: { dur: 22, w0: 2, w1: 14, wp: 9, cost: 0.9 },
};
/** lean back pulls the head this far out (metres), the roll a little less */
export const LEAN = 0.26;
export const ROLL_LEAN = 0.12;

/** the counter window a perfect slip or roll opens (frames), and how much harder punches land in it */
export const OPEN_FRAMES = 54;
export const OPEN_BONUS = 1.5;
/** a punch that lands while the other boxer is throwing (startup or contact) or recovering */
export const COUNTER_BONUS = 1.42;
export const RECOVER_BONUS = 1.18;

export const TIER_NAME = ["Tune up", "Contender", "Champion", "Legend", "Nightmare"];
/** what each tier changes in the computer's corner */
/** react: seconds to see a punch coming; tell: frames the shoulder loads before its first punch (a person can
 *  read it); defend: how often it tries to slip or block a punch it saw; adapt: how fast it learns habits */
export const TIER: Record<Tier, { react: number; tell: number; defend: number; adapt: number; accuracy: number; aggression: number; window: number; getup: number }> = {
  0: { react: 0.2, tell: 20, defend: 0.14, adapt: 0.2, accuracy: 0.75, aggression: 0.7, window: 18, getup: 0 },
  1: { react: 0.15, tell: 15, defend: 0.28, adapt: 0.45, accuracy: 0.85, aggression: 0.85, window: 14, getup: 4 },
  2: { react: 0.11, tell: 11, defend: 0.42, adapt: 0.7, accuracy: 0.93, aggression: 1.0, window: 12, getup: 8 },
  3: { react: 0.085, tell: 8, defend: 0.55, adapt: 0.88, accuracy: 1.0, aggression: 1.08, window: 10, getup: 12 },
  4: { react: 0.065, tell: 6, defend: 0.68, adapt: 1.0, accuracy: 1.05, aggression: 1.15, window: 8, getup: 16 },
};

export const TRAIT_NAME: Record<Trait, string> = {
  jab: "Jab master",
  peek: "Peek a boo",
  shell: "Shoulder roll",
  body: "Body hunter",
  iron: "Iron chin",
  dancer: "Light feet",
  bomb: "One punch power",
  hands: "Fast hands",
  engine: "Engine",
  counter: "Counter puncher",
  hook: "Left hook",
  awkward: "Awkward",
  heart: "Heart",
  upper: "Uppercut",
};

export const TRAIT_TEXT: Record<Trait, string> = {
  jab: "The jab lands harder and comes back faster.",
  peek: "Slips and ducks stay open longer.",
  shell: "The shoulder roll is easier to time and covers more.",
  body: "Body shots hurt more and drain more stamina.",
  iron: "Big shots rock him less.",
  dancer: "Moves faster on his feet and tires less doing it.",
  bomb: "The rear hand carries extra power.",
  hands: "Combinations flow sooner from hand to hand.",
  engine: "Punches cost less stamina and it comes back faster.",
  counter: "Counters land even harder.",
  hook: "The lead hook carries extra power.",
  awkward: "Hard to read: the other corner times him later.",
  heart: "Gets up from knockdowns more easily.",
  upper: "Uppercuts carry extra power.",
};

/** created fighters: every attribute starts here and the budget spreads the rest */
export const ATTR_MIN = 40;
export const ATTR_MAX = 95;
export const ATTR_BUDGET = 360;
export const ATTR_KEYS = ["power", "speed", "chin", "stamina", "defense"] as const;
