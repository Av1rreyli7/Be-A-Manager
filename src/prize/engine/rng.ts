/**
 * A small seeded random number generator (mulberry32). The state is one number kept in the fight, so a saved
 * fight carries on with the same luck it would have had.
 */
export function next(state: { rng: number }): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** a normal random number (mean 0, spread 1) */
export function gauss(state: { rng: number }): number {
  const u = Math.max(1e-9, next(state));
  const v = next(state);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** a seed from a string, for names and ids */
export function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
