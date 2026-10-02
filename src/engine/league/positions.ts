/**
 * Positional fit. ESPN only publishes G / F / C, so every player gets a continuous position score
 * (1 = PG … 5 = C) from height, playmaking and rebounding, bounded by their listed group. Lineups are
 * built slot by slot (PG, SG, SF, PF, C): playing one spot over is a small penalty, two or more is heavy.
 */
import type { Player, Position } from "../types/game";
import { clamp } from "../util/rng";

export const SLOTS: Position[] = ["PG", "SG", "SF", "PF", "C"];

const RANGE: Record<string, [number, number]> = {
  G: [1, 2.6],
  F: [2.3, 4.4],
  C: [4.7, 5],
  "G-F": [1.8, 3.4],
  "F-G": [1.8, 3.4],
  "F-C": [3.3, 5],
  "C-F": [3.3, 5],
};

/** 1 (point guard) … 5 (center). */
export function posScore(p: Pick<Player, "heightIn" | "tendencies" | "positions" | "pos">): number {
  const t = p.tendencies;
  const base = 1 + (p.heightIn - 73) / 3.3;
  const adj = -(t.astRate - 0.14) * 4 + (t.drebRate - 0.15) * 4 + (t.orebRate - 0.05) * 6 - (t.threeRate - 0.35) * 0.8;
  const key = p.positions.join("-").toUpperCase();
  let range = RANGE[key];
  if (!range) {
    const exact = SLOTS.indexOf((p.positions[0] ?? p.pos) as Position);
    const i = exact >= 0 ? exact : SLOTS.indexOf(p.pos);
    range = [i + 1 - 0.35, i + 1 + 0.35];
  }
  return clamp(base + adj, range[0], range[1]);
}

export function positionFromScore(s: number): Position {
  return SLOTS[clamp(Math.round(s), 1, 5) - 1];
}

/**
 * Strict positions: a player only plays his listed position. Anyone else is a last-resort fill-in
 * (used only when injuries leave no natural option), with a huge penalty that grows with distance.
 */
export function slotPenalty(p: Player, slot: number): number {
  if (p.pos === SLOTS[slot]) return 0;
  return 500 * Math.abs(SLOTS.indexOf(p.pos) - slot);
}

export function outOfPosition(p: Player, slot: number): boolean {
  return p.pos !== SLOTS[slot];
}

/**
 * One PG, one SG, one SF, one PF and one C - the best available at each position, returned in slot
 * order. If a position has no healthy player, the best player from the nearest position fills in.
 */
export function bestLineup(players: Player[], value: (p: Player) => number = (p) => p.ovr): Player[] {
  const pool = [...players].sort((a, b) => value(b) - value(a));
  const lineup: (Player | undefined)[] = new Array(5).fill(undefined);
  const used = new Set<Player>();
  for (let slot = 0; slot < 5; slot++) {
    const p = pool.find((x) => !used.has(x) && x.pos === SLOTS[slot]);
    if (p) {
      lineup[slot] = p;
      used.add(p);
    }
  }
  // fill empty slots from the nearest position
  for (let slot = 0; slot < 5; slot++) {
    if (lineup[slot]) continue;
    const p = pool.filter((x) => !used.has(x)).sort((a, b) => slotPenalty(a, slot) - slotPenalty(b, slot) || value(b) - value(a))[0];
    if (p) {
      lineup[slot] = p;
      used.add(p);
    }
  }
  return lineup.filter((p): p is Player => !!p);
}

type PosInput = Pick<Player, "id" | "heightIn" | "tendencies" | "positions" | "pos">;

/**
 * League-wide position assignment. ESPN lists only G / F / C, so each listed group is split at its
 * median positional score: guards → PG (more ball-dominant half) / SG; forwards → SF / PF (bigger,
 * more rebounding half); G-F → SG/SF; F-C → PF/C; C → C. Players already listed at a specific
 * position (e.g. generated prospects) keep it.
 */
export function assignPositions(players: PosInput[]): Map<string, Position> {
  const out = new Map<string, Position>();
  const groups = new Map<string, { id: string; s: number }[]>();
  for (const p of players) {
    const key = p.positions.join("-").toUpperCase();
    if (SLOTS.includes(key as Position)) {
      out.set(p.id, key as Position);
      continue;
    }
    const g = key === "F-G" ? "G-F" : key === "C-F" ? "F-C" : RANGE[key] ? key : "F";
    const arr = groups.get(g) ?? [];
    arr.push({ id: p.id, s: posScore(p) });
    groups.set(g, arr);
  }
  const split: Record<string, [Position, Position]> = { G: ["PG", "SG"], F: ["SF", "PF"], "G-F": ["SG", "SF"], "F-C": ["PF", "C"], C: ["C", "C"] };
  for (const [g, arr] of groups) {
    arr.sort((a, b) => a.s - b.s);
    const [lo, hi] = split[g] ?? ["SF", "PF"];
    arr.forEach((x, i) => out.set(x.id, i < arr.length / 2 ? lo : hi));
  }
  return out;
}
