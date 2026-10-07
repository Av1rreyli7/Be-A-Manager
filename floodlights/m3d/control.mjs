// Ball control: dribbling touches, the first touch, shielding and loose balls. The ball is never glued to a foot.
// A dribbler plays it with real touches on the beat of his footsteps: small and frequent in close control,
// bigger knock ons at a sprint, a turn touch when the direction changes. Between touches the ball rolls free
// under physics and can be nicked away. A pass arriving gets a first touch whose quality is worked out from the
// pass speed and height, the player's touch, speed, balance, the pressure on him and where he wants to go.
import { BALL_R, GRAVITY, ROLL_MU, ROLL_V, REACH } from "./consts.mjs";
import { clamp, hyp, lerp, angDiff, gauss } from "./util.mjs";
import { n01 } from "./attrs.mjs";
import { onGround } from "./ball.mjs";

// the speed a rolling ball needs to cover D metres in T seconds (constant plus linear rolling resistance)
export function rollSpeedFor(D, T) {
  const mu = ROLL_MU * GRAVITY, c = ROLL_V;
  if (T <= 0.01) return D / 0.01;
  const k = mu / c;
  const v0 = (D + k * T) * c / (1 - Math.exp(-c * T)) - k;
  return clamp(v0, 0, 40);
}
// how far a rolling ball travels from speed v0 before it stops
export function rollDistance(v0) {
  const mu = ROLL_MU * GRAVITY, c = ROLL_V, k = mu / c;
  const tStop = Math.log((v0 + k) / k) / c;
  return (v0 + k) * (1 - Math.exp(-c * tStop)) / c - k * tStop;
}

// 0 to 1: how closely the nearest opponent is on top of this player
export function pressureOn(m, p) {
  let best = 0;
  for (const o of m.teams[1 - p.team].players) {
    if (o.off || o.mode === "down") continue;
    const d = hyp(o.x - p.x, o.y - p.y);
    if (d > 4) continue;
    // closing in and facing him counts more
    const ux = (p.x - o.x) / (d || 1), uy = (p.y - o.y) / (d || 1);
    const close = (o.vx * ux + o.vy * uy) * 0.06;
    best = Math.max(best, clamp((3.4 - d) / 2.8 + close, 0, 1));
  }
  return best;
}

// where the ball should sit for this player to play it: just in front, on the side of the foot
export function contactPoint(p, out) {
  const c = Math.cos(p.face), s = Math.sin(p.face);
  const fwd = 0.34 + Math.min(0.22, p.spd * 0.03);
  out.x = p.x + c * fwd; out.y = p.y + s * fwd;
  return out;
}
const CP = { x: 0, y: 0 };

export function canPlay(p) {
  if (p.off || p.mode === "fall" || p.mode === "down" || p.mode === "getup") return false;
  if (p.mode === "stumble" && p.modeT < p.stumbleT * 0.7) return false;
  if (p.act && p.act.busy) return false;
  return true;
}

// put the ball in motion from a touch: a target spot, the time to get there, the error, the touch kind
function touchTo(m, p, tx, ty, T, err, kind, foot) {
  const b = m.ball;
  const dx = tx - b.x, dy = ty - b.y;
  let D = hyp(dx, dy);
  let ang = Math.atan2(dy, dx);
  ang += gauss(m.rng) * err.ang;
  D *= Math.max(0.3, 1 + gauss(m.rng) * err.dist);
  const v = rollSpeedFor(D, T);
  b.vx = Math.cos(ang) * v; b.vy = Math.sin(ang) * v; b.vz = 0;
  if (b.z > BALL_R + 0.05) b.vz = -0.5;
  b.wx = -b.vy / BALL_R; b.wy = b.vx / BALL_R; b.wz = 0;
  b.ctrl = p; b.last = p; b.lastTeam = p.team; b.touchT = 0; b.flight = null;
  b.immune = p; b.immuneT = 0.12;
  p.touch = { t: m.t, foot, kind, x: b.x, y: b.y }; // the view swings that foot to the ball
  p.drib.since = 0;
  p.drib.lastT = m.t;
  m.events.push({ type: "touch", by: p.id, kind, foot });
}

// the error of a touch from technique, speed, pressure, balance and fatigue
function touchErr(m, p, base) {
  const dri = n01(p.a.dri), ctl = n01(p.a.ctl), com = n01(p.a.com);
  const spd = clamp(p.spd / p.prof.vmax, 0, 1);
  const pr = pressureOn(m, p);
  const f = (1.55 - (dri * 0.6 + ctl * 0.4) * 1.1) * (1 + spd * spd * 1.6) * (1 + pr * (1.1 - com) * 0.9) * (1 + (1 - p.bal) * 1.3) * (1 + (1 - p.stam) * 0.5) * (m.wet ? 1.12 : 1);
  return { ang: base * f, dist: 0.07 * f };
}

// is this the player the person is steering right now
export function isUser(m, p) { return !!p && !m.auto && m.ctrl === p; }

// the person's dribbler: the ball goes where he goes. It rides just in front of the body through runs, sprints and
// turns, with a touch on the step beat that sends it a little ahead before it settles back, so it reads as
// dribbling. Only a tackle, a slide or a defender standing in the way at a sprint takes it off him. A knock on
// (Space) still sends it away to be chased.
function carry(m, p, dt) {
  const b = m.ball, d = p.drib, W = p.want;
  const bd = hyp(b.x - p.x, b.y - p.y);
  if (bd > 2.8) { b.ctrl = null; return; }
  if (W.knock && m.t - d.lastT > 0.15) {
    // knock it on into the space ahead and run after it
    const ux = Math.cos(p.face), uy = Math.sin(p.face);
    const D = 3.2 + n01(p.a.spd) * 2 + p.spd * 0.6;
    touchTo(m, p, p.x + ux * D, p.y + uy * D, clamp(D / Math.max(p.spd, 3), 0.5, 1.2), { ang: 0.03, dist: 0.05 }, "knock", p.prof.foot > 0 ? 0 : 1);
    W.knock = false; d.knockT = m.t;
    m.events.push({ type: "knock", by: p.id });
    return;
  }
  // after a knock on the ball runs free until he is back on it
  if (d.knockT && m.t - d.knockT < 1.6 && bd > 0.75) return;
  d.knockT = 0;
  if (b.z > 0.45) return; // a bouncing ball comes down first
  const sp = p.spd, moving = sp > 0.6;
  const ux = Math.cos(p.face), uy = Math.sin(p.face);
  // a touch on the beat: the feet play it and it surges a little ahead
  const beat = p.stepped >= 0;
  d.since += beat ? 1 : 0;
  const every = sp > p.prof.vmax * 0.8 ? 3 : 2;
  if (moving && beat && d.since >= every && m.t - d.lastT > 0.2) {
    const side = -uy * (b.x - p.x) + ux * (b.y - p.y);
    const foot = side >= 0 ? 0 : 1;
    const kind = sp > p.prof.vmax * 0.8 ? "sprint" : sp < p.prof.vmax * 0.45 ? "close" : "dribble";
    p.touch = { t: m.t, foot, kind, x: b.x, y: b.y };
    d.since = 0; d.lastT = m.t;
    b.touchT = 0;
    m.events.push({ type: "touch", by: p.id, kind, foot });
  }
  const since = m.t - d.lastT;
  const surge = moving ? (0.18 + sp * 0.025) * Math.exp(-since / 0.2) : 0;
  const L = (moving ? 0.36 + Math.min(0.42, sp * 0.05) : 0.32) + surge;
  // standing, it sits in front of the stronger foot
  const off = moving ? 0 : 0.1 * p.prof.foot;
  let cx = ux, cy = uy;
  // a ball left behind on a sharp turn goes round the side with him, never through his legs
  const rel = angDiff(p.face, Math.atan2(b.y - p.y, b.x - p.x));
  if (Math.abs(rel) > 1.2 && bd > 0.15) { const ta = p.face + Math.sign(rel) * 1.1; cx = Math.cos(ta); cy = Math.sin(ta); }
  const tx = p.x + cx * L - uy * off, ty = p.y + cy * L + ux * off;
  // a stiff spring that carries the body's own speed: no lag on a sprint, no snap on a turn
  const k = Math.min(1, dt * 16);
  b.vx += (p.vx + (tx - b.x) * 8 - b.vx) * k;
  b.vy += (p.vy + (ty - b.y) * 8 - b.vy) * k;
  if (b.z <= BALL_R + 0.02) b.vz = 0;
  b.wx = -b.vy / BALL_R; b.wy = b.vx / BALL_R; b.wz = 0;
  b.last = p; b.lastTeam = p.team; b.immune = p; b.immuneT = 0.1;
  if (!moving && m.t - d.lastT > 0.6) { p.touch = { t: m.t, foot: p.prof.foot > 0 ? 0 : 1, kind: "sole", x: b.x, y: b.y }; d.lastT = m.t; b.touchT = 0; }
}

// the dribbler: decide when to touch the ball, and steer the body so it stays with it
export function dribble(m, p, dt) {
  const b = m.ball;
  const d = p.drib;
  if (!canPlay(p)) return;
  if (isUser(m, p) && b.ctrl === p) { carry(m, p, dt); return; }
  d.since += p.stepped >= 0 ? 1 : 0;
  const W = p.want;
  const wl = hyp(W.dx, W.dy);
  const wdx = wl > 0 ? W.dx / wl : Math.cos(p.face), wdy = wl > 0 ? W.dy / wl : Math.sin(p.face);
  const moving = wl > 0 && W.spd > 0.4;
  const vmax = p.prof.vmax;
  const sprinting = W.spd > vmax * 0.8;
  // close control: shielding, a slow pace, or a man closing in (the touch tightens when pressed)
  const press = pressureOn(m, p);
  const close = W.shield || W.close || (!sprinting && W.spd < vmax * 0.45) || press > 0.55 && n01(p.a.dri) > 0.35;
  contactPoint(p, CP);
  const bd = hyp(b.x - p.x, b.y - p.y);
  const toBall = Math.atan2(b.y - p.y, b.x - p.x);
  const inFront = Math.abs(angDiff(p.face, toBall)) < 1.75 || bd < 0.32;
  const reach = REACH * (0.85 + n01(p.a.agi) * 0.15) + (close ? 0 : 0.1);
  const playable = bd < reach && b.z < 0.62 && inFront;
  const ballSp = hyp(b.vx, b.vy);
  const ballDir = ballSp > 0.3 ? Math.atan2(b.vy, b.vx) : p.face;

  // lose it: too far away, or someone else got there
  if (bd > 2.8 || b.ctrl !== p) { if (b.ctrl === p) b.ctrl = null; return; }

  // ---------- steer the body with the ball ----------
  // the body follows the ball: if it is running away, chase it; if it is behind, slow and turn to it
  const lead = (close ? 0.42 : sprinting ? 0.9 : 0.62) * p.prof.touch;
  if (!p.act || !p.act.lock) {
    const ahead = (b.x - p.x) * wdx + (b.y - p.y) * wdy; // ball distance along the wanted direction
    if (moving) {
      if (ahead > lead + 0.6 && ballSp > 0.5) W.spd = Math.min(vmax, Math.max(W.spd, p.spd + 1.5)); // catch the ball up
      else if (ahead < 0.05 && bd > 0.5) W.spd = Math.min(W.spd, Math.max(1.2, p.spd * 0.6)); // the ball is behind: ease off
      // lean the run toward the ball's line so it stays between the feet
      const lat = -(b.x - p.x) * wdy + (b.y - p.y) * wdx;
      if (Math.abs(lat) > 0.12 && bd < 2) { W.dx = wdx - wdy * lat * 0.5; W.dy = wdy + wdx * lat * 0.5; }
    } else if (bd > 0.45 && ballSp < 1.5) {
      // standing: step to the ball
      W.dx = b.x - p.x; W.dy = b.y - p.y; W.spd = Math.min(2.4, bd * 3);
    }
  }

  // ---------- standing with the ball: keep it under the sole ----------
  if (!moving && playable && ballSp < 2.2 && p.spd < 1.2) {
    if (bd < 0.65) {
      // gentle sole control: bring it to rest in front of the stronger foot
      const k = Math.min(1, dt * 6);
      const sx = CP.x - Math.sin(p.face) * 0.1 * p.prof.foot, sy = CP.y + Math.cos(p.face) * 0.1 * p.prof.foot;
      b.vx += ((sx - b.x) * 3 - b.vx) * k; b.vy += ((sy - b.y) * 3 - b.vy) * k;
      b.wx = -b.vy / BALL_R; b.wy = b.vx / BALL_R;
      b.last = p; b.lastTeam = p.team; b.touchT = 0; b.immune = p; b.immuneT = 0.1;
      if (m.t - d.lastT > 0.6) { p.touch = { t: m.t, foot: p.prof.foot > 0 ? 0 : 1, kind: "sole", x: b.x, y: b.y }; d.lastT = m.t; }
    }
    return;
  }
  if (!playable) return;

  // ---------- moving: touch on the beat ----------
  const turnNeed = Math.abs(angDiff(ballSp > 0.4 ? ballDir : p.face, Math.atan2(wdy, wdx)));
  const every = close ? 2 : sprinting ? Math.round(3 + (1 - n01(p.a.dri)) * 2 + (W.knock ? 3 : 0)) : 3;
  // where the ball will be relative to the feet at the next plant
  const ahead = (b.x - p.x) * wdx + (b.y - p.y) * wdy;
  const lowAhead = ahead < lead * 0.55;
  const beat = p.stepped >= 0;
  const turn = moving && turnNeed > 0.45 && bd < reach * 0.95;
  // about to run over it (setting off, or the ball has slowed): the foot that is there plays it now
  const along = b.vx * wdx + b.vy * wdy;
  const overrun = moving && ahead < 0.3 + p.spd * 0.04 && along < p.spd + 0.5 && m.t - d.lastT > 0.18;
  if (!beat && !overrun && !(turn && m.t - d.lastT > 0.22) && !(W.knock && m.t - d.lastT > 0.15)) return;
  if (beat && !overrun && !turn && !W.knock && d.since < every && !lowAhead) return;
  if (m.t - d.lastT < 0.14) return;
  // the touch: send the ball to where the body will be at the next touch, plus the lead
  const sp = Math.max(p.spd, Math.min(W.spd, p.spd + 2));
  const nSteps = W.knock ? 6 : every;
  const stepT = p.gait.len / Math.max(sp, 1.5);
  let T = clamp(stepT * nSteps, 0.32, W.knock ? 1.4 : 1.1);
  const vx = wdx * sp, vy = wdy * sp;
  let push = lead + (W.knock ? 3.2 + n01(p.a.spd) * 2 : 0);
  if (turn) { push *= 0.8; T = Math.max(0.35, T * 0.8); }
  const tx = p.x + vx * T + wdx * push, ty = p.y + vy * T + wdy * push;
  const err = touchErr(m, p, turn ? 0.07 : 0.04);
  // which foot: the one on the ball's side, the outside of the foot for a cut away from it
  const side = -Math.sin(p.face) * (b.x - p.x) + Math.cos(p.face) * (b.y - p.y);
  const foot = side >= 0 ? 0 : 1;
  const kind = W.knock ? "knock" : turn ? (Math.sign(angDiff(p.face, Math.atan2(wdy, wdx))) === (foot === 0 ? 1 : -1) ? "outside" : "inside") : close ? "close" : sprinting ? "sprint" : "dribble";
  // a rare heavy touch at a sprint by a poor dribbler
  if (sprinting && m.rng() < 0.035 * (1 - n01(p.a.dri)) * (1 + pressureOn(m, p))) err.dist += 0.35;
  touchTo(m, p, tx, ty, T, err, kind, foot);
  if (W.knock) { W.knock = false; m.events.push({ type: "knock", by: p.id }); }
  // a cut costs a little balance and speed
  if (turn) p.bal -= 0.05 + turnNeed * 0.04 * (1.2 - n01(p.a.agi));
}

// the first touch when a pass or a loose ball arrives. dir is where the player wants to take it (angle or null).
export function firstTouch(m, p, dir) {
  const b = m.ball;
  const inSp = hyp(b.vx, b.vy, b.vz);
  const part = b.z < 0.32 ? "foot" : b.z < 0.85 ? "thigh" : b.z < p.prof.h * 0.82 ? "chest" : "head";
  const ctl = n01(p.a.ctl), dri = n01(p.a.dri), rea = n01(p.a.rea), com = n01(p.a.com);
  const want = dir !== null && dir !== undefined ? dir : p.face;
  const inDir = Math.atan2(-b.vy, -b.vx); // where the ball came from
  const turnAng = Math.abs(angDiff(inDir, want)); // 0 = playing it back the way it came, pi = taking it on
  const pr = pressureOn(m, p);
  let q = 0.36 + ctl * 0.42 + dri * 0.1 + rea * 0.08;
  q -= Math.max(0, inSp - 9) * 0.028;
  q -= { foot: 0, thigh: 0.07, chest: 0.1, head: 0.18 }[part];
  q -= clamp(Math.PI - turnAng, 0, Math.PI) / Math.PI * 0.05; // turning with the first touch is harder than taking it on
  q -= clamp(p.spd / p.prof.vmax, 0, 1) * 0.1;
  q -= pr * 0.16 * (1.2 - com);
  q -= (1 - p.bal) * 0.2 + (1 - p.stam) * 0.05;
  if (m.wet) q -= 0.03;
  q += gauss(m.rng) * 0.11;
  if (isUser(m, p)) {
    q += 0.18;
    if (inSp < 9 && b.z < 0.5) q = Math.max(q, 0.66);
  }
  const grade = q > 0.8 ? "perfect" : q > 0.62 ? "good" : q > 0.47 ? "loose" : q > 0.34 ? "heavy" : q > 0.22 ? "awkward" : "failed";
  const side = -Math.sin(p.face) * (b.x - p.x) + Math.cos(p.face) * (b.y - p.y);
  const foot = side >= 0 ? 0 : 1;
  p.recv = { t: m.t, part, grade, foot }; // the view plays the matching control
  let dist, angErr = 0, keep = true;
  if (grade === "perfect") dist = 0.45 + p.spd * 0.25;
  else if (grade === "good") dist = 0.9 + p.spd * 0.3;
  else if (grade === "loose") dist = 2.1 + m.rng() * 0.9;
  else if (grade === "heavy") dist = 3.6 + m.rng() * 2.4;
  else if (grade === "awkward") { dist = 1.4 + m.rng() * 1.6; angErr = (m.rng() < 0.5 ? -1 : 1) * (0.6 + m.rng() * 0.8); keep = false; }
  if (grade === "failed") {
    // it bounces off: reflect off the body and lose most of the pace
    const e = 0.32 + m.rng() * 0.25;
    const nx = Math.cos(p.face), ny = Math.sin(p.face);
    const vn = b.vx * nx + b.vy * ny;
    const jf = (m.rng() - 0.5) * 2.5, js = (m.rng() - 0.5) * 2.5; // a random kick off the body, in his own frame
    b.vx = (b.vx - 2 * vn * nx) * e + jf * nx - js * ny; b.vy = (b.vy - 2 * vn * ny) * e + jf * ny + js * nx;
    b.vz = part === "foot" ? 0.4 : Math.abs(b.vz) * 0.35 + 1.4;
    b.ctrl = null; b.last = p; b.lastTeam = p.team; b.touchT = 0; b.flight = null; b.immune = p; b.immuneT = 0.15;
    m.events.push({ type: "touch", by: p.id, kind: "failed", part });
    return grade;
  }
  const a = want + angErr + gauss(m.rng) * (grade === "perfect" ? 0.04 : grade === "good" ? 0.09 : 0.16);
  const tx = p.x + Math.cos(a) * dist + p.vx * 0.3, ty = p.y + Math.sin(a) * dist + p.vy * 0.3;
  if (part === "foot") {
    const T = clamp(0.35 + dist * 0.12, 0.35, 1);
    touchTo(m, p, tx, ty, T, { ang: 0, dist: 0 }, "receive", foot);
  } else {
    // thigh, chest or head: kill the pace and drop it toward the feet in the direction asked
    const dx = tx - b.x, dy = ty - b.y, D = hyp(dx, dy) || 1;
    const hs = clamp(D * 1.1, 0.4, 4.5);
    b.vx = dx / D * hs; b.vy = dy / D * hs;
    b.vz = part === "head" ? 1.2 : part === "chest" ? 0.6 : 0.9;
    b.wx = b.wy = b.wz = 0;
    b.ctrl = p; b.last = p; b.lastTeam = p.team; b.touchT = 0; b.flight = null; b.immune = p; b.immuneT = 0.25;
    p.touch = { t: m.t, foot, kind: part, x: b.x, y: b.y };
    p.drib.since = 0; p.drib.lastT = m.t;
    m.events.push({ type: "touch", by: p.id, kind: part });
  }
  if (!keep) b.ctrl = null;
  m.events.push({ type: "control", by: p.id, grade, part });
  return grade;
}

// the person's player runs into the man on the ball: he takes it off him. Checked before bodies collide, so the
// contact that follows is on the new owner and is never a foul by the person.
export function userWin(m) {
  const p = m.ctrl, b = m.ball, c = b.ctrl;
  if (m.auto || !p || p.off || !c || c.team === p.team || b.held || p.act || !canPlay(p)) return false;
  if (b.z > 0.6) return false;
  const dB = hyp(b.x - p.x, b.y - p.y), dC = hyp(c.x - p.x, c.y - p.y);
  if (dB > 0.95 && dC > 0.9) return false;
  if (p.spd < 0.8 && dB > 0.6) return false; // he has to be going at it, or right on the ball
  // the man loses it, a little off balance, and cannot dive straight back in
  c.bal -= 0.12; c.ballLockT = m.t + 0.9;
  if (c.act && (c.act.k === "skill" || c.act.k === "kick")) c.act = null;
  b.ctrl = p; b.last = p; b.lastTeam = p.team; b.touchT = 0; b.flight = null; b.immune = p; b.immuneT = 0.3;
  b.vx = p.vx; b.vy = p.vy; b.vz = 0;
  const foot = -Math.sin(p.face) * (b.x - p.x) + Math.cos(p.face) * (b.y - p.y) >= 0 ? 0 : 1;
  p.drib.lastT = m.t; p.drib.since = 0; p.drib.knockT = 0;
  p.touch = { t: m.t, foot, kind: "tackle", x: b.x, y: b.y };
  m.events.push({ type: "tackle", by: p.id, won: true, steal: true, from: c.id });
  m.stats.tackles[p.team]++;
  if (m.lastShot) m.lastShot.on = false;
  return true;
}

// can this player meet the ball now: in front of him, low enough to play, within reach
export function canMeet(m, p, maxZ) {
  const b = m.ball;
  if (!canPlay(p)) return false;
  const bd = hyp(b.x - p.x, b.y - p.y);
  if (bd > REACH * 1.05) return false;
  if (b.z > (maxZ || p.prof.h * 1.02)) return false;
  // a ball flying past behind the back cannot be controlled
  const toBall = Math.atan2(b.y - p.y, b.x - p.x);
  if (Math.abs(angDiff(p.face, toBall)) > 2.1 && bd > 0.35) return false;
  return true;
}

// a loose ball that two players reach together: strength, balance and touch decide who gets it
export function contest(m, a, c) {
  const sa = n01(a.a.str) * 0.35 + n01(a.a.ctl) * 0.25 + a.bal * 0.25 + n01(a.a.agg) * 0.15 + m.rng() * 0.35;
  const sc = n01(c.a.str) * 0.35 + n01(c.a.ctl) * 0.25 + c.bal * 0.25 + n01(c.a.agg) * 0.15 + m.rng() * 0.35;
  return sa >= sc ? a : c;
}

export { onGround };
