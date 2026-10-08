/**
 * A date out in the city: which building is hers (one of the homes in the middle of town or the suburbs, picked
 * by her own number so it is always the same one), and where she is while they are together: waiting by her
 * door, walking out to the car, in the passenger seat, or a step behind his shoulder on foot.
 */
import type { CityPlan } from "./gen";

export interface HerDoor {
  x: number;
  z: number;
  ry: number;
  face: [number, number];
}
/** her front door: the pavement side of one of the homes away from the centre */
export function herDoor(plan: CityPlan, seed: number): HerDoor {
  const homes = plan.buildings.filter((b) => b.zone === "mid" || b.zone === "suburb");
  const list = homes.length ? homes : plan.buildings;
  const b = list[Math.abs(seed) % list.length];
  // the street side is the side nearest the edge of its block
  const lx = ((((b.x + plan.half) % plan.pitch) + plan.pitch) % plan.pitch) - plan.pitch / 2;
  const lz = ((((b.z + plan.half) % plan.pitch) + plan.pitch) % plan.pitch) - plan.pitch / 2;
  const face: [number, number] = Math.abs(lx) > Math.abs(lz) ? [Math.sign(lx) || 1, 0] : [0, Math.sign(lz) || 1];
  return { x: b.x + face[0] * (b.w / 2 + 1.4), z: b.z + face[1] * (b.d / 2 + 1.4), ry: Math.atan2(face[0], face[1]), face };
}

export type HerMode = "away" | "wait" | "walkout" | "car" | "follow";
export interface Companion {
  id: string;
  mode: HerMode;
  x: number;
  z: number;
  ry: number;
  speed: number;
  /** he has arrived at her door (the server is asked once) */
  asked: boolean;
  /** seconds walking or driving together, for a walk or a drive date */
  together: number;
  dated: boolean;
}
export const newCompanion = (id: string): Companion => ({ id, mode: "away", x: 0, z: 0, ry: 0, speed: 0, asked: false, together: 0, dated: false });

/** one step of her walking towards a point; returns how far is left */
export function stepTowards(co: Companion, tx: number, tz: number, dt: number, maxSpeed: number) {
  const dx = tx - co.x,
    dz = tz - co.z;
  const l = Math.hypot(dx, dz);
  if (l < 0.05) {
    co.speed *= Math.max(0, 1 - dt * 8);
    return l;
  }
  const want = Math.min(maxSpeed, 0.6 + l * 1.6);
  co.speed += (want - co.speed) * Math.min(1, dt * 6);
  const s = Math.min(l, co.speed * dt);
  co.x += (dx / l) * s;
  co.z += (dz / l) * s;
  co.ry = Math.atan2(dx, dz);
  return l - s;
}
