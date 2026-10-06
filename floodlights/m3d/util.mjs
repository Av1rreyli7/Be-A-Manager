// Small maths kit for the sim. No allocation in hot paths: helpers take and return plain numbers.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const hyp = Math.hypot;
export const sq = v => v * v;
export const TAU = Math.PI * 2;
export function wrapAng(a) { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; }
export function angDiff(a, b) { return wrapAng(b - a); }
export function smoothstep(e0, e1, x) { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
// move a value toward a target by at most step
export function approach(v, target, step) { return v < target ? Math.min(target, v + step) : Math.max(target, v - step); }
// turn an angle toward a target by at most step
export function turnToward(a, target, step) { const d = angDiff(a, target); return Math.abs(d) <= step ? target : wrapAng(a + Math.sign(d) * step); }
// distance from point p to segment ab, and the t along it
export function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return hyp(px - (ax + dx * t), py - (ay + dy * t));
}
export function segT(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-9;
  return clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
}
// seeded random (LCG) for tests; Math.random otherwise
export function seeded(s) { let x = s >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return (x + 0.5) / 4294967296; }; }
// a stable hash of a string, 0 to 1
export function hash01(str, salt) {
  let h = 2166136261 ^ (salt || 0);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
// a normal sample from a uniform source
export function gauss(rng) { let u = 0, v = 0; while (u === 0) u = rng(); v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
export function shortName(n) {
  const parts = String(n || "").trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] || "";
}
export const finite = v => typeof v === "number" && isFinite(v);
