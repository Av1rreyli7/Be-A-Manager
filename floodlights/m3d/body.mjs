// The player's body: locomotion, footsteps, balance, stamina, falls and collisions.
// Input and AI never move a player directly. They set an intention (p.want: direction, speed, facing) and the
// body answers it with real limits: the first step burst, speed build up toward top speed, braking, a grip limit
// on how hard it can turn at speed, a pivot that has to slow down before it can reverse, slower strafing and
// backpedalling. The gait clock advances with the distance covered, so every footstep lands where the body
// really is: the view plants each foot on the spot the sim chose and nothing slides.
import { BODY_R } from "./consts.mjs";
import { clamp, hyp, lerp, angDiff, wrapAng, turnToward } from "./util.mjs";
import { n01 } from "./attrs.mjs";

export function emptyWant(p) { return { dx: 0, dy: 0, spd: 0, face: null, jockey: 0, shield: 0, sprint: false, urgent: 0 }; }

// the top speed this player can reach right now
export function topSpeed(p, m) {
  let v = p.prof.vmax * (0.88 + 0.12 * Math.sqrt(p.stam)) * (1 - p.knock * 0.18);
  if (p.burstE < 0.25) v *= 0.93 + p.burstE * 0.28;
  if (m && m.ball.ctrl === p) v *= 0.86 + n01(p.a.dri) * 0.08;
  return v;
}

// how much of a stride a foot spends on the grass: over half when walking (both feet down for a moment), about a
// quarter at a sprint. Shared with the view so the footprints and the animation agree.
export function duty(vRel) {
  const t = Math.max(0, Math.min(1, vRel / 0.8));
  return 0.62 + (0.25 - 0.62) * (t * t * (3 - 2 * t));
}
// how far ahead of the body a foot lands: about a third of the ground the body covers while it is planted, so
// the foot comes down close under the hips (a long reach out in front is an overstride, and looks like a lunge)
export function plantLead(p, sp, stepLen) {
  return 2 * duty(sp / p.prof.vmax) * stepLen * 0.36;
}
// how far the ankle travels forward as the foot rolls from heel to toe while it is planted
export function footRoll(p, vRel) {
  return (0.05 + 0.1 * Math.min(1, vRel)) * p.prof.h;
}

// how long a step is at a speed: short quick steps when slow, long strides at full tilt
export function stepLength(p, sp) {
  const f = Math.pow(clamp(sp / p.prof.vmax, 0, 1.05), 0.72);
  return lerp(0.34 * p.prof.h / 1.8, p.prof.stepMax, f);
}

function fallDown(m, p, dir, kind, hard) {
  if (p.mode === "fall" || p.mode === "down") return;
  p.mode = "fall"; p.modeT = 0;
  p.downDir = dir;
  p.fallKind = kind; // forward, back, side, twist, knee, slide, stumble
  p.downT = 0.55 + hard * 0.7 + (1 - n01(p.a.bal)) * 0.4;
  p.act = null;
  if (m.ball.ctrl === p) m.ball.ctrl = null;
  m.events.push({ type: "fall", by: p.id, kind, dir });
}
export { fallDown };

export function stumble(m, p, dir, t) {
  if (p.mode === "fall" || p.mode === "down" || p.mode === "getup") return;
  p.mode = "stumble"; p.modeT = 0; p.stumbleT = t; p.stumbleDir = dir;
  m.events.push({ type: "stumble", by: p.id, dir });
}

// knock the balance by an amount, and fall or stumble if it runs out. dir is the direction the body is pushed.
export function hitBalance(m, p, amount, dir, kind) {
  if (p.gk && p.held) amount *= 0.4;
  p.bal -= amount;
  if (p.bal < 0.1) { fallDown(m, p, dir, kind || (Math.abs(angDiff(p.face, dir)) < 0.8 ? "forward" : Math.abs(angDiff(p.face, dir)) > 2.3 ? "back" : "side"), clamp(-p.bal, 0, 1)); p.bal = 0.2; }
  else if (p.bal < 0.38) stumble(m, p, dir, 0.25 + (0.38 - p.bal) * 1.2);
}

export function stepBody(m, p, dt) {
  const W = p.want;
  const pr = p.prof;
  p.modeT += dt;
  // ---------- on the ground and getting up ----------
  if (p.mode === "fall" || p.mode === "down" || p.mode === "getup") {
    const fr = p.mode === "fall" ? 5 : 9;
    const sp = hyp(p.vx, p.vy);
    if (sp > 0) { const f = Math.max(0, sp - fr * dt) / sp; p.vx *= f; p.vy *= f; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.mode === "fall" && p.modeT > 0.42) { p.mode = "down"; p.modeT = 0; }
    else if (p.mode === "down" && p.modeT > p.downT) { p.mode = "getup"; p.modeT = 0; p.getupT = 0.75 + (1 - n01(p.a.agi)) * 0.35 + (1 - p.stam) * 0.3; }
    else if (p.mode === "getup" && p.modeT > p.getupT) { p.mode = "free"; p.modeT = 0; p.bal = Math.max(p.bal, 0.75); }
    p.spd = hyp(p.vx, p.vy);
    return;
  }
  if (p.mode === "stumble" && p.modeT > p.stumbleT) { p.mode = "free"; p.modeT = 0; }
  const stumbling = p.mode === "stumble";

  // ---------- what the body can do right now ----------
  const vTop = topSpeed(p, m);
  const lock = p.act && p.act.lock !== undefined ? p.act.lock : 0; // 1 = the action owns the legs
  let S = Math.min(W.spd, vTop);
  let dx = W.dx, dy = W.dy;
  const dl = hyp(dx, dy);
  if (dl > 1e-6) { dx /= dl; dy /= dl; } else S = 0;
  if (stumbling) S = Math.min(S, 2.2);
  // moving relative to where the body faces: sideways and backwards are slower
  const faceTarget = W.face !== null && W.face !== undefined ? W.face : null;
  if (faceTarget !== null && S > 0) {
    const rel = Math.abs(angDiff(faceTarget, Math.atan2(dy, dx)));
    const cap = rel < 0.9 ? 1 : rel < 2.0 ? lerp(1, 0.6, (rel - 0.9) / 1.1) : lerp(0.6, 0.46, (rel - 2.0) / 1.14);
    S = Math.min(S, vTop * cap * (W.jockey ? 0.86 + n01(p.a.agi) * 0.1 : 1));
  }
  if (lock > 0) S *= 1 - lock;

  let sp = hyp(p.vx, p.vy);
  const hx = sp > 0.15 ? p.vx / sp : Math.cos(p.face), hy = sp > 0.15 ? p.vy / sp : Math.sin(p.face);
  const tvx = dx * S, tvy = dy * S;
  const fat = 0.85 + 0.15 * p.stam;
  let ax = 0, ay = 0;
  if (sp < 0.6) {
    // from a standstill: the first step drives the body out, no grip limit yet
    const ex = tvx - p.vx, ey = tvy - p.vy, e = hyp(ex, ey);
    const amax = (S > 0 ? pr.burst : pr.brake) * fat * (stumbling ? 0.4 : 1);
    if (e > 1e-6) { const a = Math.min(amax, e / dt); ax = ex / e * a; ay = ey / e * a; }
    // the body has to turn toward the run before it can push hard into it
    if (S > 0 && faceTarget === null) {
      const off = Math.abs(angDiff(p.face, Math.atan2(dy, dx)));
      if (off > 1.2) { const k = 0.35 + 0.65 * (1 - (off - 1.2) / 1.95); ax *= k; ay *= k; }
    }
  } else {
    const nx = -hy, ny = hx;
    const along = tvx * hx + tvy * hy, lat = tvx * nx + tvy * ny;
    // speed along the current heading: build up toward top speed, or brake
    let aLong;
    const dvL = along - sp;
    if (dvL > 0) aLong = Math.min(dvL / dt, Math.min(pr.burst, pr.accK * (vTop - sp) + 0.6) * fat);
    else aLong = Math.max(dvL / dt, -pr.brake * (stumbling ? 0.6 : 1) * (0.9 + 0.1 * p.stam));
    // turning: lateral acceleration limited by grip, a little tighter when tired or with the ball
    const grip = pr.grip * (stumbling ? 0.35 : 1) * (0.9 + 0.1 * p.stam) * (m.ball.ctrl === p ? 0.9 + n01(p.a.dri) * 0.1 : 1) * (m.wet ? 0.9 : 1);
    const aLat = clamp(lat / Math.max(dt, 1e-3), -grip, grip);
    ax = hx * aLong + nx * aLat; ay = hy * aLong + ny * aLat;
    // a hard cut at speed costs balance and plants the outside foot
    const cutHard = Math.abs(aLat) > grip * 0.85 && sp > 5.5 || aLong < -pr.brake * 0.8 && sp > 5;
    if (cutHard) {
      p.bal -= dt * (0.25 + sp * 0.04) * (1.25 - n01(p.a.bal) * 0.6) * (m.wet ? 1.4 : 1);
      if (m.t - (p.cutT || -9) > 0.35) { p.cutT = m.t; p.cutDir = Math.atan2(tvy, tvx); }
    }
  }
  p.ax = ax; p.ay = ay;
  p.vx += ax * dt; p.vy += ay * dt;
  sp = hyp(p.vx, p.vy);
  const vCap = vTop * 1.03;
  if (sp > vCap) { p.vx *= vCap / sp; p.vy *= vCap / sp; sp = vCap; }
  if (S === 0 && sp < 0.05) { p.vx = 0; p.vy = 0; sp = 0; }

  // ---------- facing: the body turns at a rate set by agility and speed ----------
  let want = p.face;
  if (faceTarget !== null) want = faceTarget;
  else if (sp > 0.7) want = Math.atan2(p.vy, p.vx);
  else if (S > 0) want = Math.atan2(dy, dx);
  const actTurn = p.act && p.act.turnK !== undefined ? p.act.turnK : 1;
  const omega = lerp(pr.turnLo, pr.turnHi, clamp(sp / pr.vmax, 0, 1)) * (stumbling ? 0.4 : 1) * actTurn * (0.85 + 0.15 * p.stam);
  const before = p.face;
  p.face = turnToward(p.face, want, omega * dt);
  p.faceV = angDiff(before, p.face) / dt;

  // ---------- move ----------
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.spd = sp;
  // jumping (headers, keepers): simple ballistic body
  if (p.z > 0 || p.vz > 0) {
    p.vz -= 9.81 * dt; p.z += p.vz * dt;
    if (p.z <= 0) { p.z = 0; p.vz = 0; p.landT = m.t; }
  }

  // ---------- footsteps ----------
  stepGait(m, p, dt, sp);

  // ---------- stamina, sprint reserve, balance ----------
  const effort = sp / pr.vmax;
  const sta = n01(p.a.sta);
  if (effort > 0.82) { p.burstE = Math.max(0, p.burstE - dt * (0.16 - sta * 0.06)); p.stam = Math.max(0, p.stam - dt * 0.0042 * (1.45 - sta)); }
  else {
    p.burstE = Math.min(1, p.burstE + dt * (effort < 0.5 ? 0.22 : 0.1) * (0.7 + sta * 0.5));
    p.stam = Math.max(0, p.stam - dt * 0.00035 * effort * (1.4 - sta));
    if (effort < 0.25) p.stam = Math.min(1, p.stam + dt * 0.0011 * (0.6 + sta));
  }
  p.bal = Math.min(1, p.bal + dt * (0.5 + n01(p.a.bal) * 0.65) * (0.65 + 0.35 * p.stam));
  if (p.bal < 0.1 && !stumbling) hitBalance(m, p, 0, Math.atan2(p.vy, p.vx), "stumble");
}

// The gait clock: one step every time the body covers a step length. Each step plants a foot on the ground on
// the spot the body will be over at mid stance, a little to its side. p.stepped is the foot that just planted
// (0 left, 1 right) for this tick only; the touch code takes dribble touches on these beats.
function stepGait(m, p, dt, sp) {
  p.stepped = -1;
  const g = p.gait;
  let adv = 0;
  if (sp > 0.25) { const L = stepLength(p, sp); g.len = L; adv = sp * dt / L; g.idle = 0; }
  else if (Math.abs(p.faceV) > 1.2) { adv = Math.abs(p.faceV) * dt * 0.32; g.len = 0.3; g.idle = 0; }
  else { g.idle += dt; }
  if (adv <= 0) return;
  const before = Math.floor(g.ph);
  g.ph += adv;
  if (Math.floor(g.ph) === before) return;
  const foot = Math.floor(g.ph) % 2; // 0 left, 1 right
  const side = foot === 0 ? 1 : -1; // left foot sits to the left of the direction of travel
  const dur = sp > 0.25 ? g.len / sp : 0.3;
  const hd = sp > 0.3 ? Math.atan2(p.vy, p.vx) : p.face;
  const w = 0.09 + 0.05 * clamp(1 - sp / p.prof.vmax, 0, 1);
  const lead = sp > 0.25 ? plantLead(p, sp, g.len) : 0;
  const f = g.feet[foot];
  f.x = p.x + Math.cos(hd) * lead - Math.sin(hd) * side * w;
  f.y = p.y + Math.sin(hd) * lead + Math.cos(hd) * side * w;
  f.t = m.t; f.dur = dur;
  g.foot = foot; g.dur = dur;
  p.stepped = foot;
}

// player against player: push apart, trade momentum, and decide what the contact was
export function stepCollisions(m, dt) {
  const P = m.players;
  for (let i = 0; i < P.length; i++) {
    const a = P[i];
    if (a.off) continue;
    for (let j = i + 1; j < P.length; j++) {
      const b = P[j];
      if (b.off) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) > 0.9 || Math.abs(dy) > 0.9) continue;
      const aDown = a.mode === "down" || a.mode === "fall", bDown = b.mode === "down" || b.mode === "fall";
      const R = aDown || bDown ? BODY_R * 1.2 : BODY_R * 2;
      const d = hyp(dx, dy);
      if (d >= R || d < 1e-6) continue;
      const nx = dx / d, ny = dy / d, over = R - d;
      // a player lying down is mostly stepped around, not pushed
      if (aDown || bDown) {
        const up = aDown ? b : a, s = aDown ? 1 : -1;
        up.x += nx * over * s * 0.6; up.y += ny * over * s * 0.6;
        continue;
      }
      const ma = a.prof.mass * (0.8 + 0.4 * n01(a.a.str)), mb = b.prof.mass * (0.8 + 0.4 * n01(b.a.str));
      a.x -= nx * over * mb / (ma + mb); a.y -= ny * over * mb / (ma + mb);
      b.x += nx * over * ma / (ma + mb); b.y += ny * over * ma / (ma + mb);
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (vn >= 0) continue;
      const jImp = -1.1 * vn / (1 / ma + 1 / mb);
      a.vx -= jImp / ma * nx; a.vy -= jImp / ma * ny;
      b.vx += jImp / mb * nx; b.vy += jImp / mb * ny;
      const impact = -vn;
      const key = a.id < b.id ? a.id * 64 + b.id : b.id * 64 + a.id;
      if (impact < 0.8 || (m.contacts[key] || -9) > m.t - 0.45) continue;
      m.contacts[key] = m.t;
      resolveContact(m, a, b, nx, ny, impact, ma, mb);
    }
  }
}

// what kind of contact: shoulder to shoulder, a push in the back, a head on collision. Balance moves by mass,
// strength and balance; a push in the back of a player on the ball is a foul.
function resolveContact(m, a, b, nx, ny, impact, ma, mb) {
  const ball = m.ball;
  for (const [x, y, s, mx, my] of [[a, b, 1, ma, mb], [b, a, -1, mb, ma]]) {
    // n points from x toward y
    const ux = nx * s, uy = ny * s;
    const fx = Math.cos(x.face), fy = Math.sin(x.face);
    const front = fx * ux + fy * uy; // 1: y is in front of x, -1: behind
    const share = my / (mx + my);
    let hit = impact * share * 0.11 * (1.35 - n01(x.a.bal) * 0.7);
    // shielding and a low stance brace the body
    if (x.want.shield && front < 0) hit *= 0.45;
    if (x.want.jockey) hit *= 0.8;
    x.lastBump = { by: y.id, t: m.t, dir: Math.atan2(-uy, -ux), impact };
    hitBalance(m, x, hit, Math.atan2(-uy, -ux), front > 0.5 ? "back" : front < -0.5 ? "forward" : "side");
  }
  // fouls: running into the back of the man on the ball, or flattening him without playing the ball
  for (const [atk, def, s] of [[a, b, -1], [b, a, 1]]) {
    if (ball.ctrl !== atk && !(ball.last === atk && ball.touchT < 0.4)) continue;
    if (def.team === atk.team) continue;
    const ux = nx * s, uy = ny * s; // from def toward atk
    const fx = Math.cos(atk.face), fy = Math.sin(atk.face);
    const fromBehind = fx * ux + fy * uy > 0.45;
    const defClosing = def.vx * ux + def.vy * uy;
    if (fromBehind && defClosing > 2.2 && !def.want.jockey) m.foul(def, atk, "push", clamp((defClosing - 2) * 0.25, 0.1, 0.8));
    else if (!fromBehind && defClosing > 5.2 && impact > 5.5) m.foul(def, atk, "charge", 0.35);
  }
  if (impact > 1.6) m.events.push({ type: "bump", a: a.id, b: b.id, impact });
}

export function newGait() { return { ph: 0, len: 0.6, dur: 0.3, foot: 0, idle: 0, feet: [{ x: 0, y: 0, t: 0, dur: 0.3 }, { x: 0, y: 0, t: 0, dur: 0.3 }] }; }
export { wrapAng };
