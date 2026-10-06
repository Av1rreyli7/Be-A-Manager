// Goalkeepers: positioning on the angle, setting for the shot, reacting, diving, catching, parrying with real
// rebounds, punching crosses, smothering at feet, rushing one on ones, recovering and distributing.
// A dive is a committed ballistic movement: push off the near leg, the body flies toward where the ball will
// cross, the hands reach out along the dive. The save happens only if a hand actually meets the ball's path.
import { BALL_R, HALF_L, HALF_W, GOAL_HALF, BAR_H, BOX_D, BOX_HALF, GRAVITY } from "./consts.mjs";
import { clamp, hyp, lerp, angDiff, gauss } from "./util.mjs";
import { n01 } from "./attrs.mjs";
import { predict } from "./ball.mjs";
import { emptyWant } from "./body.mjs";

const TRAJ = [];
const ownGoalX = (m, k) => -m.teams[k.team].dir * HALF_L;

export function inOwnBox(m, k, x, y) {
  const gx = ownGoalX(m, k);
  return Math.abs(x - gx) < BOX_D && Math.abs(y) < BOX_HALF && Math.sign(x - gx) === m.teams[k.team].dir;
}

// is the ball on its way into this keeper's goal: returns { t, y, z } where it crosses his line, or null
export function threat(m, k, horizon) {
  const b = m.ball;
  if (b.held || b.ctrl) return null;
  const gx = ownGoalX(m, k), dir = m.teams[k.team].dir;
  // moving toward the goal at a decent speed
  if ((b.vx * dir) > -3 && !(b.flight && b.flight.shot)) return null;
  predict(b, horizon || 2.4, 1 / 60, TRAJ, m.wet);
  const planeX = gx + dir * Math.max(0.2, Math.abs(k.x - gx) * 0.85);
  for (let i = 1; i < TRAJ.length; i++) {
    const s = TRAJ[i], s0 = TRAJ[i - 1];
    if ((s[1] - planeX) * dir <= 0 && (s0[1] - planeX) * dir > 0) {
      // where it would end up at the goal line too
      let gl = null;
      for (let j = i; j < TRAJ.length; j++) if ((TRAJ[j][1] - gx) * dir <= 0) { gl = TRAJ[j]; break; }
      const onTarget = gl ? Math.abs(gl[2]) < GOAL_HALF + 0.3 && gl[3] < BAR_H + 0.3 : Math.abs(s[2]) < GOAL_HALF + 1.5;
      if (!onTarget && !(Math.abs(s[2] - k.y) < 1.2 && s[3] < 2.3)) return null;
      return { t: s[0], x: s[1], y: s[2], z: s[3], onTarget, gy: gl ? gl[2] : s[2], gz: gl ? gl[3] : s[3] };
    }
  }
  return null;
}

// ---------- the dive ----------
function startDive(m, k, plan) {
  const dy = plan.y - k.y;
  const side = Math.sign(dy) || 1;
  const z = plan.z;
  const kind = z < 0.55 ? "low" : z < 1.5 ? "mid" : "high";
  const gkd = n01(k.a.gkd);
  // push off: lateral speed and the lift that gets the body to the ball's height
  const vLat = clamp(Math.abs(dy) / Math.max(0.25, plan.t - 0.1), 2.2, 3.6 + gkd * 2.6);
  const tAir = Math.max(0.25, plan.t - 0.08);
  const zc0 = 0.95;
  const targetZ = clamp(z - 0.35, 0.25, 1.9);
  const vz = clamp((targetZ - zc0 + 0.5 * GRAVITY * tAir * tAir) / tAir, -1, 2.4 + gkd * 1.6) * (kind === "low" ? 0.4 : 1);
  k.act = { k: "dive", own: true, busy: true, t: 0, T: 1.2, side, kind, vLat, vz, push: 0.1, zc: zc0, dirY: side, plan, saved: false, lock: 1 };
  k.dive = { t0: m.t, side, kind, ax: 0, ay: side, az: 0, bx: k.x, by: k.y, bz: zc0, hx: k.x, hy: k.y + side * 0.6, hz: zc0 + 0.4 };
  k.gkState = "dive";
  m.events.push({ type: "dive", by: k.id, side, kind });
}

function updateDive(m, k, dt) {
  const A = k.act, d = k.dive;
  A.t += dt;
  if (A.t < A.push) {
    // the push off step
    k.vy = A.dirY * A.vLat * (A.t / A.push) * 0.5;
  } else if (!A.landed) {
    const t = A.t - A.push;
    k.vy = A.dirY * A.vLat * Math.max(0.2, 1 - t * 0.9);
    A.zc = Math.max(0.2, 0.95 + A.vz * t - 0.5 * GRAVITY * t * t);
    if (A.zc <= 0.22 && t > 0.15) { A.landed = true; A.landT = A.t; m.events.push({ type: "dive_land", by: k.id, x: k.x, y: k.y }); }
  } else {
    k.vy *= Math.max(0, 1 - dt * 6);
    A.zc = 0.2;
  }
  k.vx *= 0.9;
  k.x += k.vx * dt; k.y += k.vy * dt;
  k.y = clamp(k.y, -GOAL_HALF - 2.5, GOAL_HALF + 2.5);
  // the body lies along the dive, arms out toward the ball
  const b = m.ball;
  const reach = k.prof.h * 0.55;
  d.bx = k.x; d.by = k.y; d.bz = A.zc;
  let hx = k.x, hy = k.y + A.dirY * reach, hz = A.zc + (A.kind === "high" ? 0.45 : A.kind === "low" ? 0.05 : 0.25);
  // hands track the ball a little (procedural correction toward the real ball)
  const ex = b.x - hx, ey = b.y - hy, ez = b.z - hz, e = hyp(ex, ey, ez);
  if (e < 1.2) { const k2 = Math.min(1, 0.35 / (e || 1)); hx += ex * k2; hy += ey * k2; hz += ez * k2; }
  d.hx = hx; d.hy = hy; d.hz = hz;
  d.ay = A.dirY; d.az = A.kind === "high" ? 0.35 : A.kind === "low" ? -0.15 : 0.1;
  if (!A.saved && !b.held) tryHands(m, k, k.x, k.y, A.zc, hx, hy, hz, true);
  if (A.landed && A.t - A.landT > 0.5) {
    k.act = null; k.dive = null;
    k.mode = "getup"; k.modeT = 0; k.getupT = 0.55 + (1 - n01(k.a.agi)) * 0.3;
    k.gkState = "recover";
  }
}

// a hand on the ball: the segment from the body to the hands, and how stretched the keeper is
function tryHands(m, k, bx, by, bz, hx, hy, hz, diving) {
  const b = m.ball;
  if (b.immune === k && b.immuneT > 0) return false;
  const dx = hx - bx, dy = hy - by, dz = hz - bz, l2 = dx * dx + dy * dy + dz * dz || 1e-9;
  const t = clamp(((b.x - bx) * dx + (b.y - by) * dy + (b.z - bz) * dz) / l2, 0, 1.15);
  const qx = bx + dx * t, qy = by + dy * t, qz = bz + dz * t;
  const d = hyp(b.x - qx, b.y - qy, b.z - qz);
  if (d > 0.2 + BALL_R) return false;
  const stretch = diving ? clamp(t, 0, 1) : 0.2;
  save(m, k, stretch, qx, qy, qz, diving);
  if (k.act && k.act.k === "dive") k.act.saved = true;
  return true;
}

// catch, parry, tip or punch: decided by ball speed, how stretched he is, handling and the wet
function save(m, k, stretch, hx, hy, hz, diving) {
  const b = m.ball;
  const v = hyp(b.vx, b.vy, b.vz);
  const gkh = n01(k.a.gkh);
  const limit = (11.5 + gkh * 15) * (1 - stretch * 0.55) * (m.wet ? 0.82 : 1);
  const chance = clamp((0.55 + gkh * 0.42) * (1 - stretch * 0.6) - Math.max(0, v - limit) * 0.08, 0.02, 0.97);
  const dir = m.teams[k.team].dir;
  m.stats.saves[k.team]++;
  if (v < limit && m.rng() < chance) {
    b.held = k; b.ctrl = null; b.vx = b.vy = b.vz = 0; b.wx = b.wy = b.wz = 0;
    b.last = k; b.lastTeam = k.team; b.touchT = 0; b.flight = null;
    k.gkState = "hold"; k.holdT = 0;
    k.hands = { x: hx, y: hy, z: hz };
    m.events.push({ type: "save", by: k.id, kind: "catch", stretch, power: v });
    return;
  }
  // parry: the hand pushes the ball away from the goal and toward the side he dived to
  const tip = stretch > 0.8;
  const side = Math.sign(hy - k.y) || Math.sign(b.y) || 1;
  const e = 0.25 + m.rng() * 0.25;
  if (tip) {
    // fingertips: a small change of direction, the ball keeps most of its pace
    const ang = Math.atan2(b.vy, b.vx) + side * (0.12 + m.rng() * 0.25) * Math.sign(-b.vx * dir || 1);
    const sp = hyp(b.vx, b.vy) * 0.62;
    b.vx = Math.cos(ang) * sp; b.vy = Math.sin(ang) * sp;
    b.vz = Math.max(b.vz, 0) + (hz > 1.8 ? 2.5 + m.rng() * 2 : m.rng() * 1.2);
  } else {
    const push = 3 + m.rng() * 4 + n01(k.a.gkr) * 1.5;
    b.vx = -b.vx * e + dir * push * 0.6; b.vy = b.vy * e * 0.5 + side * push * 0.75; b.vz = Math.abs(b.vz) * 0.3 + (hz > 1.2 ? 1.5 : 0.6) + m.rng();
  }
  b.wx = gauss(m.rng) * 15; b.wy = gauss(m.rng) * 15; b.wz = gauss(m.rng) * 10;
  b.ctrl = null; b.last = k; b.lastTeam = k.team; b.touchT = 0; b.flight = { kind: "parry", by: k, t: m.t };
  b.immune = k; b.immuneT = 0.35;
  m.events.push({ type: "save", by: k.id, kind: tip ? "tip" : "parry", stretch, power: v });
}

function punch(m, k) {
  const b = m.ball;
  const dir = m.teams[k.team].dir;
  const ang = Math.atan2(b.y > 0 ? 0.6 : -0.6, dir);
  const v = 11 + m.rng() * 4;
  b.vx = Math.cos(ang) * v; b.vy = Math.sin(ang) * v; b.vz = 5 + m.rng() * 2;
  b.ctrl = null; b.last = k; b.lastTeam = k.team; b.touchT = 0; b.flight = { kind: "punch", by: k, t: m.t };
  b.immune = k; b.immuneT = 0.3;
  m.events.push({ type: "save", by: k.id, kind: "punch" });
}

// ---------- the keeper's brain, every step ----------
export function updateKeeper(m, k, dt) {
  if (k.off) return;
  const b = m.ball;
  const W = k.want;
  if (k.act && k.act.k === "dive") { updateDive(m, k, dt); return; }
  if (k.mode === "fall" || k.mode === "down" || k.mode === "getup") return;
  const gx = ownGoalX(m, k), dir = m.teams[k.team].dir;
  // holding the ball: walk it out, then distribute
  if (b.held === k) {
    k.holdT = (k.holdT || 0) + dt;
    k.hands = { x: k.x + Math.cos(k.face) * 0.25, y: k.y + Math.sin(k.face) * 0.25, z: 1.05 };
    b.x = k.hands.x; b.y = k.hands.y; b.z = k.hands.z;
    W.face = dir > 0 ? 0 : Math.PI; W.dx = dir; W.dy = -k.y * 0.1; W.spd = k.holdT < 1 ? 0 : 1.6;
    if (Math.abs(k.x - gx) > BOX_D - 2) W.spd = 0;
    if (m.phase === "play" && k.holdT > (m.userKeeperHold ? 9 : 1.4 + m.rng() * 0.05)) m.distribute(k);
    return;
  }
  // a penalty: keepers guess. The person picks the side with W or S; the AI keeper guesses, his reflexes let
  // him read a slow or central one
  const R0 = m.restartKick;
  if (R0 && R0.kind === "penalty" && R0.by.team !== k.team && m.t - R0.t < 1.2 && !k.act) {
    if (!k.penGuess) {
      const userKeeper = k.team === m.userTeam && !m.auto;
      let side = 0;
      if (userKeeper) { const my = m.userIn ? m.userIn.my : 0; side = Math.abs(my) > 0.3 ? Math.sign(my) : 0; }
      else {
        const r = m.rng();
        side = r < 0.4 ? -1 : r < 0.8 ? 1 : 0;
        // a sharp keeper reads where the taker is really going a little more often
        const th0 = threat(m, k, 1.5);
        if (th0 && m.rng() < 0.15 + n01(k.a.gkr) * 0.25) side = Math.abs(th0.y - k.y) < 0.8 ? 0 : Math.sign(th0.y - k.y);
      }
      k.penGuess = { side, t: m.t };
    }
    if (m.ball.flight && m.t - k.penGuess.t > 0.12 && k.penGuess.side !== 0 && !k.penGuess.went) {
      k.penGuess.went = true;
      startDive(m, k, { t: 0.42, x: k.x, y: k.y + k.penGuess.side * 2.5, z: 0.6 + m.rng() * 1.2 });
      return;
    }
  } else if (k.penGuess && (!R0 || m.t - R0.t > 1.2)) k.penGuess = null;
  // a shot or a ball heading for goal
  const th = m.phase === "play" ? threat(m, k, 2.4) : null;
  if (th) {
    const rt = k.prof.reactT * (b.screened ? 1.4 : 1) * (b.flight && b.flight.kind === "parry" ? 1.3 : 1);
    if (!k.react || k.react.ballT !== b.touchT && b.touchT < 0.05) k.react = { t0: m.t, ballT: b.touchT };
    k.gkState = "set";
    W.spd = 0; W.face = Math.atan2(b.y - k.y, b.x - k.x);
    if (m.t - k.react.t0 >= rt) {
      const dy = th.y - k.y;
      const reachStand = 0.62 + k.prof.h * 0.08;
      if (Math.abs(dy) < reachStand && th.z < k.prof.h + 0.35) {
        // standing save: the hands go to the ball
        const hz = clamp(th.z, 0.15, k.prof.h + 0.3);
        k.hands = { x: k.x + dir * 0.35, y: th.y, z: hz };
        if (th.z > k.prof.h - 0.1 && k.z === 0 && th.t < 0.3) k.vz = 2.6; // jump to a high one
        tryHands(m, k, k.x, k.y, 1.0, k.x + dir * 0.4, clamp(th.y, k.y - reachStand, k.y + reachStand), hz, false);
        W.dx = 0; W.dy = Math.sign(dy); W.spd = Math.abs(dy) > 0.2 ? 2.5 : 0;
      } else if (th.t < 0.95 && (th.onTarget || Math.abs(dy) < 2)) {
        startDive(m, k, th);
      } else {
        // time to shuffle across first
        W.dx = 0; W.dy = Math.sign(dy); W.spd = 3.2; W.face = Math.atan2(b.y - k.y, b.x - k.x);
      }
    }
    return;
  }
  k.react = null;
  k.hands = null;
  // a cross into his area: claim it if he can get there first, punch if it is crowded
  if (b.flight && !b.ctrl && b.z > 1.2 && (b.flight.kind === "cross" || b.flight.kind === "lob" || b.flight.kind === "corner" || b.flight.kind === "freekick")) {
    const land = landing(m);
    if (land && Math.abs(land.x - gx) < 9 && Math.abs(land.y) < 9 && inOwnBox(m, k, land.x, land.y)) {
      const tk = hyp(land.x - k.x, land.y - k.y) / (k.prof.vmax * 0.85) + k.prof.reactT;
      const claim = n01(k.a.gkp) * 0.5 + n01(k.a.gkh) * 0.3;
      if (tk < land.t + 0.15 && claim > 0.35) {
        k.gkState = "claim";
        W.dx = land.x - k.x; W.dy = land.y - k.y; W.spd = k.prof.vmax; W.face = Math.atan2(b.y - k.y, b.x - k.x);
        const d = hyp(b.x - k.x, b.y - k.y);
        if (d < 1.1 && b.z < k.prof.h + 0.95 && b.z > 1.2) {
          if (k.z === 0) k.vz = 3;
          const crowd = m.teams[1 - k.team].players.some(o => !o.off && hyp(o.x - k.x, o.y - k.y) < 1.3);
          if (crowd && m.rng() < 0.55) punch(m, k);
          else tryHands(m, k, k.x, k.y, 1.3 + k.z, k.x, k.y, k.prof.h + 0.55 + k.z, false) || punch(m, k);
        }
        return;
      }
    }
  }
  // one on one: an attacker through with nobody between him and the goal
  const att = b.ctrl && b.ctrl.team !== k.team ? b.ctrl : null;
  const near = att ? hyp(att.x - gx, att.y) : hyp(b.x - gx, b.y);
  if (m.phase === "play" && att && near < 22 && clear(m, k, att)) {
    k.gkState = "rush";
    const loose = hyp(b.x - att.x, b.y - att.y) > 1.3;
    const tk = hyp(b.x - k.x, b.y - k.y) / (k.prof.vmax * 0.9);
    const ta = hyp(b.x - att.x, b.y - att.y) / Math.max(1, att.spd);
    if (loose && tk < ta + 0.1 && hyp(b.x - k.x, b.y - k.y) < 3.2 && inOwnBox(m, k, b.x, b.y)) {
      // smother: go down at the feet and gather it
      startDive(m, k, { t: 0.3, x: b.x, y: b.y, z: 0.2 });
      k.act.kind = "smother"; k.dive.kind = "smother";
      k.vx = (b.x - k.x) * 3;
      m.events.push({ type: "smother", by: k.id });
      return;
    }
    // come out to narrow the angle, stay big, do not go to ground early
    const ux = (att.x - gx), uy = att.y, ul = hyp(ux, uy) || 1;
    const out = clamp(near * 0.45, 1.5, 10);
    W.dx = gx + ux / ul * out - k.x; W.dy = uy / ul * out - k.y;
    W.spd = hyp(W.dx, W.dy) > 0.4 ? k.prof.vmax * 0.85 : 0;
    W.face = Math.atan2(att.y - k.y, att.x - k.x);
    return;
  }
  // positioning on the angle: on the line from the goal centre to the ball, depth by how far the ball is
  k.gkState = "pos";
  const bx = b.held ? b.held.x : b.x, by = b.held ? b.held.y : b.y;
  const dxb = bx - gx, dyb = by;
  const dist = hyp(dxb, dyb);
  const gkp = n01(k.a.gkp);
  let depth;
  if (dist > 45) depth = 9 + gkp * 4; // sweeper: behind a high line
  else if (dist > 28) depth = lerp(3.5, 9, (dist - 28) / 17);
  else if (dist > 14) depth = lerp(1.4, 3.5, (dist - 14) / 14);
  else depth = 1.1;
  // a near post angle: hug the post side a bit when the ball is wide
  let tx = gx + dxb / (dist || 1) * depth, ty = dyb / (dist || 1) * depth;
  ty = clamp(ty, -GOAL_HALF + 0.5, GOAL_HALF - 0.5) * (dist < 14 ? 1 : 0.85);
  if (Math.abs(tx - gx) > BOX_D - 1) tx = gx + dir * (BOX_D - 1);
  const ex = tx - k.x, ey = ty - k.y, e = hyp(ex, ey);
  W.dx = ex; W.dy = ey;
  // shuffle when it is a small adjustment, run when it is far, stay set when the ball is close
  W.spd = e < 0.15 ? 0 : e < 2.5 ? Math.min(3.6, e * 2.4) : k.prof.vmax * 0.8;
  W.face = Math.atan2(by - k.y, bx - k.x);
  W.jockey = e < 2.5 ? 1 : 0;
}

// is the attacker clean through: no team mate of the keeper within the corridor between him and the goal
function clear(m, k, att) {
  const gx = ownGoalX(m, k);
  for (const d of m.teams[k.team].players) {
    if (d === k || d.off || d.mode === "down") continue;
    const t = clamp(((d.x - att.x) * (gx - att.x) + (d.y - att.y) * (0 - att.y)) / ((gx - att.x) ** 2 + att.y ** 2 || 1), 0, 1);
    const px = att.x + (gx - att.x) * t, py = att.y - att.y * t;
    if (t > 0.05 && hyp(d.x - px, d.y - py) < 2.2) return false;
    if (hyp(d.x - att.x, d.y - att.y) < 2) return false;
  }
  return true;
}

// where a ball in the air comes down (first time below 1.6 m on its way down)
export function landing(m) {
  const b = m.ball;
  predict(b, 2.8, 1 / 30, TRAJ, m.wet);
  for (let i = 1; i < TRAJ.length; i++) if (TRAJ[i][3] < 1.6 && TRAJ[i][3] < TRAJ[i - 1][3]) return { t: TRAJ[i][0], x: TRAJ[i][1], y: TRAJ[i][2] };
  return null;
}

export { emptyWant };
