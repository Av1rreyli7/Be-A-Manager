// The football as a physical object: position, velocity, spin, air drag, Magnus curve, bounce with friction that
// trades slip for spin, rolling resistance on grass, posts, crossbar, the net, and players' bodies.
// The sim calls stepBall once per 60 Hz step; it sub steps at 240 Hz.
// ball.z is the height of the ball's centre, so a ball on the grass sits at z = BALL_R.
import { BALL_R, BALL_M, GRAVITY, BALL_SUB, DRAG_K, MAGNUS_K, SPIN_DECAY_AIR, SPIN_DECAY_GROUND, BOUNCE_E, BOUNCE_MU, ROLL_MU, ROLL_V, BALL_I, HALF_L, GOAL_HALF, BAR_H, GOAL_DEPTH, POST_R } from "./consts.mjs";
import { hyp, clamp } from "./util.mjs";

export function createBall() {
  return {
    x: 0, y: 0, z: BALL_R, vx: 0, vy: 0, vz: 0, wx: 0, wy: 0, wz: 0,
    ctrl: null, // the player dribbling it (soft possession, the ball is never attached)
    last: null, lastTeam: -1, touchT: 9, // who touched it last and how long ago
    held: null, // a keeper holding it in his hands
    flight: null, // what the last kick was meant to do: { kind, by, to, tx, ty, t }
    immune: null, immuneT: 0, // the player who just played it does not block his own kick
    netHit: null, // { x, y, z, power, t } for the view's net bulge
    trail: 0
  };
}

export const onGround = b => b.z <= BALL_R + 0.02 && Math.abs(b.vz) < 0.6;
export const ballSpeed = b => hyp(b.vx, b.vy, b.vz);

// what the rules, the AI and the view want to know after a step: post and bar hits, body deflections
function ev(m, type, extra) { m.events.push(Object.assign({ type }, extra || {})); }

// one integration sub step of free flight or roll, no bodies
function integrate(b, h, wet) {
  const v = hyp(b.vx, b.vy, b.vz);
  let ax = 0, ay = 0, az = 0;
  const air = b.z > BALL_R + 0.003 || b.vz > 0.05;
  if (v > 0.01) {
    const k = DRAG_K * v;
    ax -= k * b.vx; ay -= k * b.vy; az -= k * b.vz;
    if (air) {
      // Magnus: spin across the direction of travel bends the ball (w x v)
      ax += MAGNUS_K * (b.wy * b.vz - b.wz * b.vy);
      ay += MAGNUS_K * (b.wz * b.vx - b.wx * b.vz);
      az += MAGNUS_K * (b.wx * b.vy - b.wy * b.vx);
    }
  }
  if (air) {
    az -= GRAVITY;
    const sd = Math.exp(-SPIN_DECAY_AIR * h);
    b.wx *= sd; b.wy *= sd; b.wz *= sd;
  }
  b.vx += ax * h; b.vy += ay * h; b.vz += az * h;
  b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
  if (b.z <= BALL_R) {
    b.z = BALL_R;
    if (b.vz < -0.55) {
      // bounce: restitution drops a touch on hard impacts, wet grass skids
      const vin = -b.vz;
      const e = clamp(BOUNCE_E - vin * 0.006, 0.38, BOUNCE_E) * (wet ? 0.92 : 1);
      b.vz = vin * e;
      // friction impulse at the contact point, limited by Coulomb, changes both the slide and the spin
      const ux = b.vx - b.wy * BALL_R, uy = b.vy + b.wx * BALL_R;
      const u = hyp(ux, uy);
      if (u > 1e-4) {
        const jn = (1 + e) * vin; // per unit mass
        const jStop = u / (1 + 1 / BALL_I);
        const j = Math.min(BOUNCE_MU * (wet ? 0.75 : 1) * jn, jStop);
        const nx = ux / u, ny = uy / u;
        b.vx -= j * nx; b.vy -= j * ny;
        b.wx += -j * ny / (BALL_I * BALL_R);
        b.wy += j * nx / (BALL_I * BALL_R);
      }
      b.wz *= 0.7;
    } else {
      // rolling: the grass grips the ball into pure roll and slows it
      b.vz = 0;
      const sp = hyp(b.vx, b.vy);
      if (sp > 0) {
        const dec = (ROLL_MU * GRAVITY * (wet ? 0.8 : 1) + ROLL_V * sp) * h;
        const f = sp > dec ? (sp - dec) / sp : 0;
        b.vx *= f; b.vy *= f;
      }
      const g = Math.min(1, 14 * h);
      b.wx += (-b.vy / BALL_R - b.wx) * g;
      b.wy += (b.vx / BALL_R - b.wy) * g;
      b.wz *= Math.exp(-SPIN_DECAY_GROUND * h);
    }
  }
}

// posts and crossbar of both goals
function woodwork(m, b) {
  for (const sx of [-1, 1]) {
    const gx = sx * HALF_L;
    if (Math.abs(b.x - gx) > 0.6) continue;
    for (const sy of [-1, 1]) {
      const px = gx, py = sy * GOAL_HALF;
      const dx = b.x - px, dy = b.y - py, d = hyp(dx, dy), R = BALL_R + POST_R;
      if (d < R && b.z < BAR_H + POST_R) {
        const nx = dx / (d || 1), ny = dy / (d || 1);
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= 1.72 * vn * nx; b.vy -= 1.72 * vn * ny;
          b.wz += (b.vx * ny - b.vy * nx) * 2;
          if (-vn > 2) { ev(m, "post", { x: px, y: py, z: b.z, power: -vn }); m.ballHitWood = 0.2; }
        }
        b.x = px + nx * R; b.y = py + ny * R;
      }
    }
    // crossbar: a cylinder along y at height BAR_H
    if (Math.abs(b.y) < GOAL_HALF + BALL_R) {
      const dx = b.x - gx, dz = b.z - BAR_H, d = hyp(dx, dz), R = BALL_R + POST_R;
      if (d < R) {
        const nx = dx / (d || 1), nz = dz / (d || 1);
        const vn = b.vx * nx + b.vz * nz;
        if (vn < 0) {
          b.vx -= 1.7 * vn * nx; b.vz -= 1.7 * vn * nz;
          b.wy *= -0.5;
          if (-vn > 2) { ev(m, "post", { x: gx, y: b.y, z: BAR_H, bar: true, power: -vn }); m.ballHitWood = 0.2; }
        }
        b.x = gx + nx * R; b.z = BAR_H + nz * R;
      }
    }
  }
}

// the net catches the ball: inside the goal it soaks up the speed, from outside the side netting stops it
function net(m, b) {
  const ax = Math.abs(b.x);
  if (ax < HALF_L - BALL_R || ax > HALF_L + GOAL_DEPTH + 0.4) return;
  const sx = Math.sign(b.x);
  const back = HALF_L + GOAL_DEPTH;
  const inside = ax > HALF_L && Math.abs(b.y) < GOAL_HALF && b.z < BAR_H;
  if (inside) {
    let hit = 0;
    if (ax > back - BALL_R) { b.x = sx * (back - BALL_R); if (b.vx * sx > 0) { hit = Math.abs(b.vx); b.vx *= -0.12; b.vy *= 0.55; b.vz *= 0.55; } }
    if (Math.abs(b.y) > GOAL_HALF - BALL_R) { const sy = Math.sign(b.y); b.y = sy * (GOAL_HALF - BALL_R); if (b.vy * sy > 0) { hit = Math.max(hit, Math.abs(b.vy)); b.vy *= -0.12; b.vx *= 0.6; } }
    if (b.z > BAR_H - BALL_R) { b.z = BAR_H - BALL_R; if (b.vz > 0) { hit = Math.max(hit, b.vz); b.vz *= -0.1; b.vx *= 0.6; } }
    if (hit > 1.2 && (!b.netHit || m.t - b.netHit.t > 0.3)) b.netHit = { x: b.x, y: b.y, z: b.z, power: hit, t: m.t };
  } else if (ax > HALF_L + BALL_R * 0.5) {
    // outside the goal frame but behind the line: side netting and roof from the outside
    const nearSide = Math.abs(Math.abs(b.y) - GOAL_HALF) < BALL_R && b.z < BAR_H;
    const onRoof = Math.abs(b.y) < GOAL_HALF && Math.abs(b.z - BAR_H) < BALL_R && ax < back;
    if (nearSide && ax < back) {
      const sy = Math.sign(b.y);
      b.y = sy * (GOAL_HALF + BALL_R);
      if (b.vy * sy < 0) { if (Math.abs(b.vy) > 1.5) b.netHit = { x: b.x, y: b.y, z: b.z, power: Math.abs(b.vy), t: m.t, side: true }; b.vy *= -0.1; b.vx *= 0.5; }
    } else if (onRoof) {
      b.z = BAR_H + BALL_R;
      if (b.vz < 0) { b.vz *= -0.2; b.vx *= 0.6; b.vy *= 0.6; }
    }
  }
}

// body parts of a player as capsules, used to deflect the ball (legs, torso, head, a sliding or diving body)
// returns the number of capsules written into out (each [ax, ay, az, bx, by, bz, r, part])
export function bodyCapsules(p, out) {
  let n = 0;
  const h = p.prof.h, c = Math.cos(p.face), s = Math.sin(p.face), z0 = p.z || 0;
  const put = (ax, ay, az, bx, by, bz, r, part) => { const o = out[n] || (out[n] = new Float64Array(8)); o[0] = ax; o[1] = ay; o[2] = az; o[3] = bx; o[4] = by; o[5] = bz; o[6] = r; o[7] = part; n++; };
  if (p.mode === "down" || p.mode === "fall" && p.modeT > 0.25) {
    // lying on the grass
    const fx = Math.cos(p.downDir || p.face), fy = Math.sin(p.downDir || p.face);
    put(p.x - fx * h * 0.45, p.y - fy * h * 0.45, 0.14, p.x + fx * h * 0.45, p.y + fy * h * 0.45, 0.14, 0.17, 1);
    return n;
  }
  if (p.act && p.act.k === "slide" && p.act.phase === "slide") {
    const fx = Math.cos(p.act.dir), fy = Math.sin(p.act.dir);
    put(p.x - fx * 0.8, p.y - fy * 0.8, 0.2, p.x + fx * 0.95, p.y + fy * 0.95, 0.12, 0.16, 0);
    return n;
  }
  if (p.dive) {
    // a diving keeper: the body stretched along the dive, hands handled by the keeper code
    const d = p.dive;
    put(d.bx - d.ax * 0.7, d.by - d.ay * 0.7, d.bz - d.az * 0.7, d.bx + d.ax * 0.55, d.by + d.ay * 0.55, d.bz + d.az * 0.55, 0.2, 1);
    return n;
  }
  // standing or running: legs as one wide capsule (a bit wider when blocking), torso, head
  const legR = p.act && p.act.k === "block" ? 0.32 : 0.16;
  const fwd = 0.06;
  put(p.x + c * fwd, p.y + s * fwd, z0 + 0.08, p.x + c * fwd * 0.5, p.y + s * fwd * 0.5, z0 + h * 0.5, legR, 0);
  put(p.x, p.y, z0 + h * 0.52, p.x, p.y, z0 + h * 0.8, 0.19, 1);
  put(p.x, p.y, z0 + h - 0.12, p.x, p.y, z0 + h - 0.1, 0.115, 2);
  return n;
}
const CAPS = [];

// ball against every player's body. A player who is deliberately playing the ball (touch, kick, header,
// catch) is skipped: his contact is resolved by the action itself.
function bodies(m, b) {
  if (b.z > 3.2) return;
  for (const p of m.players) {
    if (p.off) continue;
    if (p === b.immune && b.immuneT > 0) continue;
    if (p === b.ctrl && p.mode !== "down") continue;
    if (Math.abs(p.x - b.x) > 1.6 || Math.abs(p.y - b.y) > 1.6) continue;
    const n = bodyCapsules(p, CAPS);
    for (let i = 0; i < n; i++) {
      const c = CAPS[i];
      // closest point on the segment to the ball
      const dx = c[3] - c[0], dy = c[4] - c[1], dz = c[5] - c[2];
      const l2 = dx * dx + dy * dy + dz * dz || 1e-9;
      const t = clamp(((b.x - c[0]) * dx + (b.y - c[1]) * dy + (b.z - c[2]) * dz) / l2, 0, 1);
      const qx = c[0] + dx * t, qy = c[1] + dy * t, qz = c[2] + dz * t;
      const ex = b.x - qx, ey = b.y - qy, ez = b.z - qz, d = hyp(ex, ey, ez), R = BALL_R + c[6];
      if (d >= R) continue;
      const nx = ex / (d || 1), ny = ey / (d || 1), nz = ez / (d || 1);
      // relative velocity against the body (the body moves with the player)
      const rvx = b.vx - p.vx, rvy = b.vy - p.vy, rvz = b.vz - (p.vz || 0);
      const vn = rvx * nx + rvy * ny + rvz * nz;
      b.x = qx + nx * R; b.y = qy + ny * R; b.z = Math.max(BALL_R, qz + nz * R);
      if (vn < 0) {
        const e = c[7] === 2 ? 0.5 : c[7] === 1 ? 0.32 : 0.42;
        b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; b.vz -= (1 + e) * vn * nz;
        // the rest of the speed is soaked up by the body
        const damp = 0.82;
        b.vx = p.vx + (b.vx - p.vx) * damp; b.vy = p.vy + (b.vy - p.vy) * damp; b.vz *= damp;
        b.wx *= 0.4; b.wy *= 0.4; b.wz *= 0.4;
        if (-vn > 1.2) {
          const was = b.last;
          ev(m, "deflect", { by: p.id, team: p.team, power: -vn, part: c[7], from: was ? was.id : -1 });
          m.lastDeflect = { p, t: m.t, power: -vn, part: c[7], fromTeam: b.lastTeam };
        }
        b.last = p; b.lastTeam = p.team; b.touchT = 0;
        if (b.ctrl && b.ctrl !== p) b.ctrl = null;
        b.flight = b.flight && -vn < 3 ? b.flight : null;
        b.immune = p; b.immuneT = 0.06;
      }
      break;
    }
  }
}

export function stepBall(m, dt) {
  const b = m.ball;
  if (b.held) {
    // in a keeper's hands: the keeper code puts it where his hands are
    b.vx = b.held.vx; b.vy = b.held.vy; b.vz = 0; b.wx = b.wy = b.wz = 0;
    return;
  }
  const h = dt / BALL_SUB;
  for (let i = 0; i < BALL_SUB; i++) {
    integrate(b, h, m.wet);
    woodwork(m, b);
    net(m, b);
    if (!m.dead) bodies(m, b);
  }
  b.touchT += dt;
  if (b.immuneT > 0) b.immuneT -= dt;
  if (m.ballHitWood > 0) m.ballHitWood -= dt;
}

// predict where the ball will be: fills out with [t, x, y, z] samples every dtS for T seconds, no bodies.
// Used by the AI (intercepts, receiving, keeper) and by the kick solver.
export function predict(b, T, dtS, out, wet) {
  const s = { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, wx: b.wx, wy: b.wy, wz: b.wz };
  const n = Math.ceil(T / dtS);
  const sub = Math.max(1, Math.round(dtS / (1 / 120)));
  const h = dtS / sub;
  let k = 0;
  for (let i = 0; i <= n; i++) {
    const o = out[k] || (out[k] = new Float64Array(4));
    o[0] = i * dtS; o[1] = s.x; o[2] = s.y; o[3] = s.z;
    k++;
    for (let j = 0; j < sub; j++) integrate(s, h, wet);
  }
  out.length = k;
  return out;
}

// a quick forward simulation from a launch state, for the kick solver: returns where and when the ball
// first reaches plane x = px (dir sign sx), or lands, whichever is asked
export function simulate(state, h, maxT, stop) {
  const s = Object.assign({}, state);
  for (let t = 0; t < maxT; t += h) {
    integrate(s, h, false);
    if (stop(s, t + h)) return Object.assign(s, { t: t + h });
  }
  return Object.assign(s, { t: maxT });
}

export { BALL_M };
