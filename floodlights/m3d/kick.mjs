// Kicks: every pass, cross, clearance and shot goes through here.
// A kick is an action with a real wind up: plant, backswing, the strike when the foot reaches the ball, the
// follow through. Contact quality comes from where the ball actually is at the strike, the angle between the
// body and the kick, balance, pressure, the weak foot, fatigue and the player's technique. The launch is solved
// against the same ball physics the match runs (drag, spin, Magnus), so a curler, a dipping drive or a floated
// cross flies the way the physics says, and the error the player adds is real error.
import { BALL_R, GRAVITY, HALF_L, HALF_W, GOAL_HALF, BAR_H, BOX_D, BOX_HALF, REACH } from "./consts.mjs";
import { clamp, hyp, lerp, angDiff, gauss, wrapAng, segT } from "./util.mjs";
import { n01 } from "./attrs.mjs";
import { simulate } from "./ball.mjs";
import { rollSpeedFor, rollDistance, pressureOn, canPlay } from "./control.mjs";

// contact times (seconds from the button to the strike) and total action length per kick kind
const KINDS = {
  pass:     { tc: 0.13, T: 0.42, lock: 0.45, tech: "spa", err: 0.035 },
  driven:   { tc: 0.17, T: 0.5, lock: 0.5, tech: "spa", err: 0.045 },
  through:  { tc: 0.15, T: 0.45, lock: 0.45, tech: "vis", err: 0.04 },
  lob:      { tc: 0.22, T: 0.6, lock: 0.55, tech: "lpa", err: 0.05 },
  lobthru:  { tc: 0.22, T: 0.6, lock: 0.55, tech: "lpa", err: 0.05 },
  cross:    { tc: 0.24, T: 0.62, lock: 0.55, tech: "cro", err: 0.05 },
  crosslow: { tc: 0.2, T: 0.55, lock: 0.55, tech: "cro", err: 0.045 },
  cutback:  { tc: 0.15, T: 0.48, lock: 0.5, tech: "cro", err: 0.04 },
  backheel: { tc: 0.12, T: 0.45, lock: 0.5, tech: "dri", err: 0.08 },
  clear:    { tc: 0.18, T: 0.55, lock: 0.55, tech: "lpa", err: 0.09 },
  shot:     { tc: 0.22, T: 0.6, lock: 0.6, tech: "fin", err: 0.075 },
  low:      { tc: 0.2, T: 0.58, lock: 0.6, tech: "fin", err: 0.065 },
  finesse:  { tc: 0.25, T: 0.62, lock: 0.6, tech: "cur", err: 0.07 },
  chip:     { tc: 0.2, T: 0.58, lock: 0.6, tech: "fin", err: 0.075 },
  power:    { tc: 0.42, T: 0.8, lock: 0.75, tech: "pow", err: 0.085 },
  outside:  { tc: 0.18, T: 0.55, lock: 0.55, tech: "cur", err: 0.06 },
  volley:   { tc: 0.08, T: 0.6, lock: 0.7, tech: "fin", err: 0.1 },
  header:   { tc: 0.0, T: 0.6, lock: 0.5, tech: "hea", err: 0.06 }
};
export const SHOT_KINDS = new Set(["shot", "low", "finesse", "chip", "power", "outside", "volley"]);
export { KINDS };

const goalX = (m, team) => m.teams[team].dir * HALF_L; // the goal this team attacks

// ---------- planning: turn an intention into a kick spec with a target ----------

// time for a player to get to a point (rough: turn, accelerate, run)
export function timeToReach(p, x, y) {
  const d = hyp(x - p.x, y - p.y);
  const v = p.prof.vmax * (0.9 + 0.1 * p.stam);
  const dir = Math.atan2(y - p.y, x - p.x);
  const vAlong = p.vx * Math.cos(dir) + p.vy * Math.sin(dir);
  const turn = Math.abs(angDiff(p.face, dir)) / (p.prof.turnLo * 0.8);
  const tAcc = Math.max(0, (v - Math.max(0, vAlong)) / Math.max(p.prof.burst, 3));
  const dAcc = (Math.max(0, vAlong) + v) / 2 * tAcc;
  return turn * 0.6 + (d <= dAcc ? d / Math.max(1, (Math.max(0, vAlong) + v) / 2) : tAcc + (d - dAcc) / v) + p.prof.reactT;
}

// how risky a ground ball from (ax, ay) to (bx, by) taking time T is: the best chance any opponent has of cutting it out
export function laneRisk(m, team, ax, ay, bx, by, T, ignore) {
  const opp = m.teams[1 - team].players;
  let risk = 0;
  const D = hyp(bx - ax, by - ay) || 1;
  for (const o of opp) {
    if (o.off || o === ignore || o.mode === "down") continue;
    const t = segT(o.x, o.y, ax, ay, bx, by);
    const px = ax + (bx - ax) * t, py = ay + (by - ay) * t;
    const tb = T * Math.pow(t, 0.8); // the ball is quick early and slows later
    const reach = (o.gk ? 1.6 : 1.0) + Math.max(0, tb - o.prof.reactT) * o.prof.vmax * 0.75;
    const d = hyp(o.x - px, o.y - py);
    const r = clamp((reach - d) / 1.6 + 0.5, 0, 1) * (t > 0.08 ? 1 : 0.3);
    if (r > risk) risk = r;
  }
  return risk;
}

// the speed a ground pass needs to arrive with a little pace left
export function passSpeed(D, arrive) {
  let lo = 2, hi = 34;
  for (let i = 0; i < 26; i++) {
    const v = (lo + hi) / 2;
    const reach = rollDistance(v) - rollDistance(Math.min(v, arrive));
    if (reach < D) lo = v; else hi = v;
  }
  return (lo + hi) / 2;
}
function rollTime(v0, D) {
  // time to cover D from v0 (numerical, coarse)
  const mu = 0.055 * GRAVITY, c = 0.13;
  let t = 0, x = 0, v = v0;
  while (x < D && v > 0.05 && t < 9) { const h = 0.02; v -= (mu + c * v) * h; x += v * h; t += h; }
  return t;
}

// predicted spot of a team mate after t seconds (he keeps running where he is going, slowing a little)
function lead(q, t, k) {
  const tx = q.ai && q.ai.runTo ? q.ai.runTo : null;
  if (tx) {
    const d = hyp(tx.x - q.x, tx.y - q.y);
    const s = Math.min(d, q.prof.vmax * 0.85 * t);
    return { x: q.x + (tx.x - q.x) / (d || 1) * s, y: q.y + (tx.y - q.y) / (d || 1) * s };
  }
  return { x: q.x + q.vx * t * k, y: q.y + q.vy * t * k };
}

// the best team mate for a pass in a direction: angle first, then how open he is and where he is
export function pickReceiver(m, p, dir, maxAng, kindLong) {
  const T = m.teams[p.team];
  let best = null, bestS = -1e9;
  for (const q of T.players) {
    if (q === p || q.off || q.mode === "down") continue;
    const d = hyp(q.x - p.x, q.y - p.y);
    if (d < 3 || d > (kindLong ? 60 : 42)) continue;
    const a = Math.atan2(q.y - p.y, q.x - p.x);
    const off = Math.abs(angDiff(dir, a));
    if (off > maxAng) continue;
    const v = passSpeed(d, 4 + d * 0.08), t = rollTime(v, d);
    const risk = kindLong ? 0.2 : laneRisk(m, p.team, p.x, p.y, q.x, q.y, t, null);
    const fwd = (q.x - p.x) * T.dir;
    const s = -off * 3.2 - risk * 2.2 + fwd * 0.012 - Math.abs(d - 16) * 0.02 - (m.offsideAt && isOffside(m, q) ? 3 : 0);
    if (s > bestS) { bestS = s; best = q; }
  }
  return best;
}

export function isOffside(m, q) {
  const T = m.teams[q.team];
  if (q.gk) return false;
  const ax = q.x * T.dir; // positive is toward the goal he attacks
  if (ax <= 0) return false;
  if (ax <= m.ball.x * T.dir) return false;
  // second last defender
  const opp = m.teams[1 - q.team].players.filter(o => !o.off).map(o => o.x * T.dir).sort((a, b) => b - a);
  const second = opp[1] !== undefined ? opp[1] : -HALF_L;
  return ax > second + 0.15;
}

// a ground pass to a team mate (or into space along dir when nobody is there)
export function planPass(m, p, dir, power, opts) {
  opts = opts || {};
  const q = opts.to || pickReceiver(m, p, dir, opts.wide ? 1.2 : 0.8, false);
  let tx, ty, v, to = null, kind = opts.kind || "pass";
  if (q) {
    let d = hyp(q.x - p.x, q.y - p.y), t = 0.6, P = { x: q.x, y: q.y };
    for (let i = 0; i < 3; i++) {
      v = passSpeed(d, 4.5 + d * 0.09);
      t = rollTime(v, d) + KINDS[kind].tc;
      P = lead(q, t, 0.85);
      d = hyp(P.x - p.x, P.y - p.y);
    }
    tx = P.x; ty = P.y; to = q;
    if (power !== null && power !== undefined) v *= lerp(0.82, 1.4, power);
    if (v > 17 && kind === "pass") kind = "driven";
  } else {
    const D = lerp(8, 34, power === null || power === undefined ? 0.45 : power);
    tx = p.x + Math.cos(dir) * D; ty = p.y + Math.sin(dir) * D;
    v = passSpeed(D, 3);
  }
  return { kind, tx, ty, v, to, power: power || 0 };
}

// a through ball: into the space ahead of a runner, timed so he gets there first
export function planThrough(m, p, dir, power, lofted) {
  const T = m.teams[p.team];
  let best = null, bestS = -1e9;
  for (const q of T.players) {
    if (q === p || q.off || q.gk) continue;
    const a = Math.atan2(q.y - p.y, q.x - p.x);
    if (Math.abs(angDiff(dir, a)) > 1.0) continue;
    // his run: where he is heading, or straight at goal
    const rv = hyp(q.vx, q.vy);
    let ux = rv > 2 ? q.vx / rv : T.dir, uy = rv > 2 ? q.vy / rv : 0;
    if (ux * T.dir < 0.2) { ux = T.dir * 0.85; uy = clamp(-q.y / 40, -0.5, 0.5); }
    const ul = hyp(ux, uy); ux /= ul; uy /= ul;
    for (let s = 4; s <= 26; s += 2.5) {
      let X = q.x + ux * s, Y = q.y + uy * s;
      X = clamp(X, -HALF_L + 2, HALF_L - 2); Y = clamp(Y, -HALF_W + 1.5, HALF_W - 1.5);
      // never past the keeper's reach in his own box
      const gx = goalX(m, p.team);
      if (Math.abs(X - gx) < 7 && Math.abs(Y) < 12) continue;
      const tq = timeToReach(q, X, Y);
      const D = hyp(X - p.x, Y - p.y);
      const tb = Math.max(tq - 0.15, 0.4);
      const v = lofted ? 0 : rollSpeedFor(D, tb);
      if (!lofted && (v > 28 || v < 6)) continue;
      // can a defender get there first?
      let beat = 9;
      for (const o of m.teams[1 - p.team].players) { if (o.off) continue; beat = Math.min(beat, timeToReach(o, X, Y) - tq); }
      const risk = lofted ? 0 : laneRisk(m, p.team, p.x, p.y, X, Y, tb, null);
      const prog = (X - q.x) * T.dir;
      const sc = beat * 1.4 + prog * 0.05 - risk * 2.5 - (isOffside(m, q) ? 6 : 0) - Math.abs(angDiff(dir, Math.atan2(Y - p.y, X - p.x))) * 1.5;
      if (sc > bestS) { bestS = sc; best = { q, X, Y, tb, v, D, beat }; }
    }
  }
  if (!best) {
    const D = lerp(14, 34, power || 0.5);
    const X = p.x + Math.cos(dir) * D, Y = p.y + Math.sin(dir) * D;
    return lofted ? { kind: "lobthru", tx: X, ty: Y, T: 1.4 + D * 0.02, to: null, power } : { kind: "through", tx: X, ty: Y, v: rollSpeedFor(D, D / 11), to: null, power };
  }
  // power pushes the ball further on
  const push = ((power || 0.5) - 0.5) * 6;
  const X = best.X + Math.cos(dir) * push, Y = best.Y + Math.sin(dir) * push;
  if (lofted) return { kind: "lobthru", tx: X, ty: Y, T: clamp(best.tb, 1.1, 2.6), to: best.q, power, margin: best.beat };
  return { kind: "through", tx: X, ty: Y, v: rollSpeedFor(hyp(X - p.x, Y - p.y), best.tb), to: best.q, power, margin: best.beat };
}

// a lofted ball to a team mate's head or feet
export function planLob(m, p, dir, power) {
  const q = pickReceiver(m, p, dir, 0.7, true);
  if (q) {
    const d = hyp(q.x - p.x, q.y - p.y);
    const T = clamp(0.9 + d * 0.034, 1.0, 2.6) * lerp(1.15, 0.85, power || 0.5);
    const P = lead(q, T + 0.22, 0.8);
    return { kind: "lob", tx: P.x, ty: P.y, T, to: q, power };
  }
  const D = lerp(15, 50, power || 0.5);
  return { kind: "lob", tx: p.x + Math.cos(dir) * D, ty: p.y + Math.sin(dir) * D, T: 1 + D * 0.03, to: null, power };
}

// crosses: near post, penalty spot or far post by the stick, aimed at a runner when there is one
export function planCross(m, p, dir, power, low) {
  const T = m.teams[p.team];
  const gx = goalX(m, p.team);
  const side = Math.sign(p.y) || 1;
  const nearByline = Math.abs(p.x - gx) < 10;
  // cutback: from the byline, pulling it back toward the edge of the box
  const back = Math.cos(dir) * T.dir < -0.2;
  if (nearByline && back) {
    const tx = gx - T.dir * 11.5, ty = side * 3 * m.rng();
    let to = null, bd = 9;
    for (const q of T.players) { if (q === p || q.off) continue; const d = hyp(q.x - tx, q.y - ty); if (d < bd) { bd = d; to = q; } }
    const P = to ? lead(to, 0.8, 0.7) : { x: tx, y: ty };
    const D = hyp(P.x - p.x, P.y - p.y);
    return { kind: "cutback", tx: P.x, ty: P.y, v: passSpeed(D, 6), to, power };
  }
  // zones: near post, spot, far post. The stick up or down (toward or away from this wing) picks one.
  const along = Math.sin(dir) * -side; // > 0 means toward the middle and beyond
  const zones = [
    { x: gx - T.dir * 5.5, y: side * 2.6, name: "near" },
    { x: gx - T.dir * 10.5, y: 0, name: "spot" },
    { x: gx - T.dir * 6.5, y: -side * 3.6, name: "far" }
  ];
  let zi = along > 0.55 ? 2 : along < -0.1 ? 0 : 1;
  if (Math.abs(p.x - gx) > 26) zi = 1; // an early cross goes for the spot and the runners
  let Z = zones[zi];
  // aim at the best placed attacker near the zone
  let to = null, bd = 7;
  for (const q of T.players) { if (q === p || q.off || q.gk) continue; const d = hyp(q.x - Z.x, q.y - Z.y); if (d < bd) { bd = d; to = q; } }
  const D = hyp(Z.x - p.x, Z.y - p.y);
  if (low) {
    return { kind: "crosslow", tx: Z.x, ty: Z.y, v: clamp(passSpeed(D, 9) * 1.05, 14, 26), to, power, zone: Z.name, lift: 2.2 };
  }
  // floated with little power, whipped with more (faster, flatter, curling away from the keeper)
  const pw = power === null || power === undefined ? 0.6 : power;
  const flight = clamp(D / lerp(17, 25, pw), 0.9, 2.2);
  return { kind: "cross", tx: Z.x, ty: Z.y, T: flight, to, power: pw, zone: Z.name, whip: pw > 0.55 };
}

// shots: the corner picked by the stick, finesse curls, chips go over, power drives
export function planShot(m, p, aim, power, kind) {
  const T = m.teams[p.team];
  const gx = goalX(m, p.team);
  const k = m.teams[1 - p.team].gk;
  // aim across the goal: the stick up or down picks the post, nothing picks the far side from the keeper
  let ty;
  if (aim !== null && Math.abs(aim) > 0.2) ty = clamp(aim, -1, 1) * (GOAL_HALF - 0.5);
  else {
    const kOff = k ? k.y : 0;
    const far = Math.abs(p.y) > 4 ? -Math.sign(p.y) : kOff > 0 ? -1 : 1;
    ty = far * (GOAL_HALF - 0.6);
  }
  let tz;
  const pw = power === null || power === undefined ? 0.6 : power;
  if (kind === "low") tz = 0.25;
  else if (kind === "chip") tz = 1.7;
  else if (kind === "finesse") tz = 1.1 + pw * 0.8;
  else if (kind === "power") tz = 0.6 + pw * 1.1;
  else tz = 0.35 + pw * 1.5;
  return { kind, tx: gx + T.dir * 0.3, ty, tz, power: pw, shot: true };
}

// ---------- the launch: from a spec and a contact quality to ball velocity and spin ----------

function topspin(ux, uy, s) { return [-uy * s, ux * s]; }

// solve a lofted ball to land on (tx, ty) after about T seconds
function solveLob(b, tx, ty, T, spinTop, spinSide) {
  let D = hyp(tx - b.x, ty - b.y), ang = Math.atan2(ty - b.y, tx - b.x);
  let vh = D / T, vz = GRAVITY * T / 2;
  for (let i = 0; i < 4; i++) {
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const [wx, wy] = topspin(ux, uy, spinTop);
    const s = simulate({ x: b.x, y: b.y, z: Math.max(b.z, BALL_R), vx: ux * vh, vy: uy * vh, vz, wx, wy, wz: spinSide }, 1 / 120, T * 2 + 1, st => st.z <= BALL_R + 0.01 && st.vz < 0);
    const got = hyp(s.x - b.x, s.y - b.y);
    vh *= clamp(D / (got || 1), 0.7, 1.4);
    vz *= clamp(T / (s.t || T), 0.85, 1.2);
    // correct the sideways drift from curve
    const off = angDiff(ang, Math.atan2(s.y - b.y, s.x - b.x));
    ang -= off * 0.9;
  }
  return { vh, vz, ang };
}

// solve a shot of speed v to pass through (tx, ty, tz) when it crosses x = tx
function solveShot(b, tx, ty, tz, v, spinTop, spinSide) {
  let ang = Math.atan2(ty - b.y, tx - b.x);
  const D0 = hyp(tx - b.x, ty - b.y);
  let el = Math.atan2(tz - b.z, D0) + 0.5 * GRAVITY * D0 / (v * v);
  const sgn = Math.sign(tx - b.x) || 1;
  for (let i = 0; i < 5; i++) {
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const [wx, wy] = topspin(ux, uy, spinTop);
    const s = simulate({ x: b.x, y: b.y, z: b.z, vx: ux * v * Math.cos(el), vy: uy * v * Math.cos(el), vz: v * Math.sin(el), wx, wy, wz: spinSide }, 1 / 240, 3, st => (st.x - tx) * sgn >= 0 || st.z < 0.05 && st.vz < -1);
    const D = hyp(s.x - b.x, s.y - b.y) || 1;
    // y grows with the angle when the ball goes toward +x and shrinks when it goes toward -x
    ang += clamp((ty - s.y) / D, -0.4, 0.4) * Math.sign(ux || 1) * (Math.abs(ux) > 0.2 ? 1 : 0.5);
    el += clamp((tz - s.z) / D, -0.3, 0.3);
  }
  return { ang, el };
}

// contact quality 0 to 1 at the strike, from geometry and the player's state
function contactQuality(m, p, spec, foot) {
  const b = m.ball;
  const K = KINDS[spec.kind] || KINDS.pass;
  const tech = n01(p.a[K.tech] || 60);
  const c = Math.cos(p.face), s = Math.sin(p.face);
  // ideal spot: in front and to the side of the kicking foot
  const side = foot === 1 ? -0.12 : 0.12;
  const ix = p.x + c * 0.36 - s * side, iy = p.y + s * 0.36 + c * side;
  const off = hyp(b.x - ix, b.y - iy);
  let q = 1 - clamp((off - 0.12) / 0.6, 0, 1) * 0.55;
  // kicking across the body
  const kickDir = Math.atan2(spec.ty - p.y, spec.tx - p.x);
  const bodyOff = Math.abs(angDiff(p.face, kickDir));
  q -= clamp((bodyOff - 0.9) / 1.6, 0, 1) * (spec.kind === "backheel" ? 0 : 0.35);
  // the weak foot
  const strong = (p.prof.foot > 0 ? 0 : 1) === foot;
  if (!strong) q -= (5 - p.prof.weak) * 0.06;
  // balance, speed, pressure, fatigue
  q -= (1 - p.bal) * 0.35;
  q -= clamp(p.spd / p.prof.vmax, 0, 1) * (SHOT_KINDS.has(spec.kind) ? 0.12 : 0.05);
  q -= pressureOn(m, p) * 0.18 * (1.15 - n01(p.a.com));
  q -= (1 - p.stam) * 0.08;
  // a ball in the air or coming fast is harder to strike cleanly
  const bsp = hyp(b.vx, b.vy, b.vz);
  if (b.z > BALL_R + 0.08) q -= clamp((b.z - 0.15) * 0.25, 0, 0.25) * (1.1 - tech);
  if (bsp > 6) q -= (bsp - 6) * 0.012 * (1.2 - tech);
  q = q * (0.55 + 0.45 * tech) + gauss(m.rng) * 0.05;
  return clamp(q, 0.05, 1);
}

// strike the ball. Returns false on a fresh air kick (the ball was not there).
export function strike(m, p, spec, foot) {
  const b = m.ball;
  const K = KINDS[spec.kind] || KINDS.pass;
  const tech = n01(p.a[K.tech] || 60);
  const cq = contactQuality(m, p, spec, foot);
  // technique sets the spread: an elite finisher is about twice as tight as a poor one
  const errScale = (1.5 - tech * 0.95) * (0.5 + (1 - cq) * 1.9) * (m.wet ? 1.08 : 1);
  const side = foot === 1 ? 1 : -1; // the right foot (index 0) curls the ball to its left on screen: negative spin about z
  let vx, vy, vz, wx = 0, wy = 0, wz = 0;
  const dirTo = Math.atan2(spec.ty - b.y, spec.tx - b.x);
  if (spec.shot) {
    const pw = n01(p.a.pow);
    let v;
    if (spec.kind === "chip") v = lerp(11, 16.5, spec.power) + pw * 1.5;
    else if (spec.kind === "finesse") v = lerp(17, 25, spec.power) + pw * 2.5;
    else if (spec.kind === "power") v = lerp(25, 33, spec.power) + pw * 4;
    else if (spec.kind === "volley") v = lerp(18, 28, spec.power) + pw * 3 + hyp(b.vx, b.vy) * 0.15;
    else if (spec.kind === "low") v = lerp(16, 25, spec.power) + pw * 3;
    else v = lerp(16.5, 28, spec.power) + pw * 3.5;
    v *= 0.88 + 0.12 * cq;
    let top = 0, sideSpin = 0;
    if (spec.kind === "finesse" || spec.kind === "outside") sideSpin = side * (24 + n01(p.a.cur) * 30) * (spec.kind === "outside" ? -0.8 : 1);
    if (spec.kind === "power" || spec.kind === "shot") top = 6 + spec.power * 10;
    if (spec.kind === "chip") top = -22;
    if (spec.kind === "low") top = 4;
    // pick an aim point a little outside the target for a curler so it bends back in
    let ty = spec.ty;
    if (sideSpin) ty -= Math.sign(sideSpin) * 0.4 * Math.sign(spec.tx - b.x || 1) * -1;
    const sol = solveShot(b, spec.tx, ty, spec.tz, v, top, sideSpin);
    // error: horizontal and vertical, power past the sweet spot sends it high
    const eh = gauss(m.rng) * K.err * errScale;
    const over = Math.max(0, spec.power - 0.82) * (1.3 - n01(p.a.fin)) * 0.35;
    const ev = gauss(m.rng) * K.err * errScale * 0.8 + over * (0.5 + m.rng());
    const ang = sol.ang + eh, el = sol.el + ev;
    vx = Math.cos(ang) * Math.cos(el) * v; vy = Math.sin(ang) * Math.cos(el) * v; vz = Math.sin(el) * v;
    const [tx2, ty2] = topspin(Math.cos(ang), Math.sin(ang), top);
    wx = tx2; wy = ty2; wz = sideSpin;
  } else if (spec.kind === "lob" || spec.kind === "lobthru" || spec.kind === "cross" || spec.kind === "clear") {
    const whip = spec.kind === "cross" && spec.whip;
    const sideSpin = whip ? side * (18 + n01(p.a.cur) * 22) : spec.kind === "cross" ? side * 8 : 0;
    const top = spec.kind === "clear" ? -6 : whip ? 3 : -10;
    const T = spec.T || 1.6;
    const sol = solveLob(b, spec.tx, spec.ty, T, top, sideSpin);
    const eh = gauss(m.rng) * K.err * errScale, ed = 1 + gauss(m.rng) * K.err * errScale * 1.6;
    const ang = sol.ang + eh;
    vx = Math.cos(ang) * sol.vh * ed; vy = Math.sin(ang) * sol.vh * ed; vz = sol.vz * (1 + gauss(m.rng) * K.err * errScale);
    const [tx2, ty2] = topspin(Math.cos(ang), Math.sin(ang), top);
    wx = tx2; wy = ty2; wz = sideSpin;
  } else {
    // ground balls: pass, driven, through, cutback, backheel, low cross
    let v = spec.v || passSpeed(hyp(spec.tx - b.x, spec.ty - b.y), 4);
    const eh = gauss(m.rng) * K.err * errScale, ed = 1 + gauss(m.rng) * K.err * errScale * 1.4;
    const ang = dirTo + eh;
    v *= ed;
    vx = Math.cos(ang) * v; vy = Math.sin(ang) * v;
    vz = spec.kind === "driven" ? 0.6 + v * 0.05 : spec.kind === "crosslow" ? spec.lift || 1.8 : spec.kind === "cutback" ? 0 : 0;
    if (cq < 0.35) vz += m.rng() * 2.5; // a scuffed pass bobbles up
    const [tx2, ty2] = topspin(Math.cos(ang), Math.sin(ang), v / BALL_R * (spec.kind === "driven" ? 0.8 : 0.5));
    wx = tx2; wy = ty2;
  }
  // the ball leaves from where it is; a little of the kicker's run carries into it
  b.vx = vx + p.vx * 0.15; b.vy = vy + p.vy * 0.15; b.vz = vz;
  b.wx = wx; b.wy = wy; b.wz = wz;
  if (b.z < BALL_R) b.z = BALL_R;
  b.ctrl = null; b.last = p; b.lastTeam = p.team; b.touchT = 0;
  b.immune = p; b.immuneT = 0.18;
  b.flight = { kind: spec.kind, by: p, to: spec.to || null, tx: spec.tx, ty: spec.ty, t: m.t, shot: !!spec.shot, cq };
  p.kickT = m.t;
  p.bal -= (spec.kind === "power" ? 0.16 : spec.shot ? 0.07 : 0.03) + (1 - cq) * 0.12;
  m.events.push({ type: "kick", by: p.id, kind: spec.kind, foot, cq, power: spec.power || 0, shot: !!spec.shot, to: spec.to ? spec.to.id : -1 });
  m.onKick(p, spec, cq);
  return true;
}

// ---------- the kick action: wind up, strike, follow through ----------

export function startKick(m, p, spec) {
  const K = KINDS[spec.kind] || KINDS.pass;
  // the foot: the strong foot unless the ball sits clearly on the other side or the angle needs the other one
  const b = m.ball;
  const sideBall = -Math.sin(p.face) * (b.x - p.x) + Math.cos(p.face) * (b.y - p.y);
  const kickDir = Math.atan2(spec.ty - p.y, spec.tx - p.x);
  const across = angDiff(p.face, kickDir);
  // foot index 0 is the foot on the body's +y side, drawn on screen as the anatomical right foot
  let foot = p.prof.foot > 0 ? 0 : 1;
  if (p.prof.weak >= 3 && (sideBall > 0.18 && foot === 1 || sideBall < -0.18 && foot === 0)) foot = 1 - foot;
  if (Math.abs(across) > 1.2 && spec.kind !== "backheel" && p.prof.weak >= 3) foot = across > 0 ? 1 : 0;
  // power shots, and anything hit hard by a poor technician, take longer to set up
  let tc = K.tc * (1.15 - n01(p.a.rea) * 0.25) * (spec.kind === "pass" && spec.v > 14 ? 1.25 : 1);
  if (spec.firstTime) tc = Math.min(tc, 0.09);
  const T = K.T * (spec.firstTime ? 0.8 : 1);
  // a ball a stride or two ahead is run onto first: the wind up starts when it is within reach
  const fx = p.x + Math.cos(p.face) * 0.4, fy = p.y + Math.sin(p.face) * 0.4;
  const far = !spec.firstTime && hyp(b.x - fx, b.y - fy) > 0.75;
  p.act = { k: "kick", spec, t: 0, tc, T, lock: K.lock, busy: true, foot, turnK: 0.55, dir: kickDir, struck: false, approach: far, t0: 0 };
  if (!far) m.events.push({ type: "windup", by: p.id, kind: spec.kind, foot, tc });
}

export function updateKick(m, p, dt) {
  const A = p.act;
  A.t += dt;
  const b = m.ball;
  if (A.approach) {
    // run onto the ball: aim a little behind it on the line of the kick so the body arrives square
    const lead = 0.45;
    const tx = b.x + b.vx * 0.15 - Math.cos(A.dir) * lead, ty = b.y + b.vy * 0.15 - Math.sin(A.dir) * lead;
    const ex = tx - p.x, ey = ty - p.y, e = hyp(ex, ey);
    p.want.dx = ex; p.want.dy = ey; p.want.face = null;
    p.want.spd = Math.min(p.prof.vmax, Math.max(p.spd, hyp(b.vx, b.vy) + e * 2.2));
    A.lock = 0; A.turnK = 1;
    const fx = p.x + Math.cos(p.face) * 0.4, fy = p.y + Math.sin(p.face) * 0.4;
    const d = hyp(b.x - fx, b.y - fy);
    const lost = b.held || b.last !== p && b.last && b.last.team !== p.team && b.touchT < A.t;
    if (lost || A.t > 1.1 || d > 3.5) { p.act = null; return; }
    if (d < 0.75 && b.z < 0.8) { A.approach = false; A.t0 = A.t; A.turnK = 0.55; A.lock = KINDS[A.spec.kind] ? KINDS[A.spec.kind].lock : 0.5; A.T += A.t; A.tc += A.t; m.events.push({ type: "windup", by: p.id, kind: A.spec.kind, foot: A.foot, tc: A.tc - A.t }); }
    else return;
  }
  if (!A.struck) {
    // plant and line up: turn toward the kick, slow down, take a small corrective step toward the ball
    const want = A.dir;
    const across = angDiff(p.face, want);
    p.want.face = Math.abs(across) > 1.4 && A.spec.kind !== "backheel" ? p.face + Math.sign(across) * 1.0 : null;
    if (A.spec.kind === "backheel") p.want.face = p.face;
    const left = Math.max(0.02, A.tc - A.t);
    // where the ball will be at the strike, and where the foot wants it
    const bx = b.x + b.vx * left, by = b.y + b.vy * left;
    const c = Math.cos(p.face), s = Math.sin(p.face), side = A.foot === 1 ? -0.12 : 0.12;
    const ix = p.x + c * 0.36 - s * side, iy = p.y + s * 0.36 + c * side;
    const ex = bx - ix, ey = by - iy, e = hyp(ex, ey);
    if (e > 0.05 && e < 2.2) {
      const need = Math.min(e / left, 3.2);
      p.want.dx = ex; p.want.dy = ey; p.want.spd = Math.max(need, p.spd * 0.5);
      A.lock = 0;
    } else { p.want.spd = p.spd * 0.6; A.lock = A.lock || 0.4; }
    if (A.t >= A.tc) {
      // the strike: only if the ball is really there. A ball still rolling in (or a player still arriving)
      // is met a moment later, the way a player runs onto it; one that has gone is an air kick.
      const fx = p.x + c * 0.4, fy = p.y + s * 0.4;
      const dNow = hyp(b.x - fx, b.y - fy);
      const zMax = A.spec.kind === "volley" ? 2.0 : 0.8;
      const reachOk = dNow < 0.72 && b.z < zMax;
      const stolen = b.last !== p && b.touchT < A.t && b.last && b.last.team !== p.team;
      if (reachOk && !stolen && !b.held) { A.struck = true; strike(m, p, A.spec, A.foot); }
      else if (stolen || b.held || A.t > A.tc + 0.42 || dNow > 2.4 && (A.lastD === undefined || dNow >= A.lastD)) { A.struck = true; A.whiff = true; m.events.push({ type: "whiff", by: p.id, d: dNow }); }
      A.lastD = dNow;
    }
  } else {
    p.want.spd = Math.min(p.want.spd, p.spd);
    A.lock = A.t < A.tc + 0.15 ? 0.6 : 0.3;
  }
  if (A.t >= A.T) p.act = null;
}

// can p strike the ball first time (it is arriving, low enough, in front)
export function inStrikeRange(m, p, maxZ) {
  const b = m.ball;
  if (!canPlay(p)) return false;
  const d = hyp(b.x - p.x, b.y - p.y);
  return d < REACH * 1.15 && b.z < (maxZ || 0.75);
}

export { goalX };
