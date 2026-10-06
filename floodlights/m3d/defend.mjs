// Defending: jockeying, standing and poke tackles, slide tackles, shoulder challenges, blocks and interceptions.
// A tackle is decided where the feet actually are when the leg arrives: if the ball is within the tackling
// foot's reach it is played (won clean, poked loose or blocked), if the carrier's legs are there instead it is a
// trip, and if neither is there it simply misses and the defender is left committed for a moment.
import { BALL_R, REACH } from "./consts.mjs";
import { clamp, hyp, angDiff, gauss } from "./util.mjs";
import { n01 } from "./attrs.mjs";
import { hitBalance, fallDown } from "./body.mjs";
import { canPlay } from "./control.mjs";

const leg = p => p.prof.h * 0.52; // leg length

// ---------- standing tackle and poke ----------
export function startTackle(m, p, poke) {
  if (!canPlay(p) || p.act) return false;
  const b = m.ball;
  const d = hyp(b.x - p.x, b.y - p.y);
  const maxD = poke ? 2.3 : 1.75;
  if (d > maxD + 0.6) return false;
  const tc = (poke ? 0.15 : 0.21) * (1.12 - n01(p.a.rea) * 0.22);
  p.act = { k: poke ? "poke" : "tackle", t: 0, tc, T: poke ? 0.45 : 0.62, lock: 0.35, busy: true, turnK: 0.8, done: false, dir: Math.atan2(b.y - p.y, b.x - p.x), foot: -Math.sin(p.face) * (b.x - p.x) + Math.cos(p.face) * (b.y - p.y) > 0 ? 0 : 1 };
  m.events.push({ type: "tackle_go", by: p.id, poke: !!poke });
  return true;
}

export function updateTackle(m, p, dt) {
  const A = p.act, b = m.ball;
  A.t += dt;
  if (!A.done) {
    // step in toward the ball, lower the body
    A.dir = Math.atan2(b.y - p.y, b.x - p.x);
    p.want.face = A.dir;
    const d = hyp(b.x - p.x, b.y - p.y);
    p.want.dx = Math.cos(A.dir); p.want.dy = Math.sin(A.dir);
    p.want.spd = Math.min(p.want.spd || 3, d > 1 ? 4 : 1.5);
    if (A.t >= A.tc) { A.done = true; resolveTackle(m, p, A.k === "poke"); }
  } else {
    p.want.spd = 0.5;
    A.lock = 0.5;
  }
  if (A.t >= A.T) p.act = null;
}

function resolveTackle(m, p, poke) {
  const b = m.ball;
  const reach = leg(p) * (poke ? 1.75 : 1.32) + 0.1;
  const fx = p.x + Math.cos(p.act.dir) * Math.min(reach, hyp(b.x - p.x, b.y - p.y)), fy = p.y + Math.sin(p.act.dir) * Math.min(reach, hyp(b.x - p.x, b.y - p.y));
  const ballD = hyp(b.x - fx, b.y - fy);
  const carrier = b.ctrl && b.ctrl.team !== p.team ? b.ctrl : null;
  const tck = n01(p.a.tck), awa = n01(p.a.awa);
  p.act.dir = Math.atan2(b.y - p.y, b.x - p.x);
  // the carrier's legs: are they in the way first
  let legsHit = false;
  if (carrier) {
    const cd = hyp(carrier.x - fx, carrier.y - fy);
    const behind = Math.abs(angDiff(carrier.face, Math.atan2(carrier.y - p.y, carrier.x - p.x))) < 1.0;
    legsHit = cd < 0.55 && (ballD > 0.42 || behind && m.rng() < 0.5);
  }
  if (ballD < 0.46 && b.z < 0.7 && !legsHit) {
    // the foot gets to the ball. How cleanly depends on whether the carrier had it close.
    let win;
    if (carrier) {
      // how exposed the ball was: right at his feet, in between, or nearer the tackler
      const toC = hyp(b.x - carrier.x, b.y - carrier.y), toT = hyp(b.x - p.x, b.y - p.y);
      const tight = toC < 0.5 && b.touchT < 0.3;
      const shield = carrier.want.shield ? 0.2 : 0;
      const base = tight ? 0.18 : toT < toC ? 0.55 : 0.36;
      win = base + tck * 0.34 + awa * 0.06 - n01(carrier.a.dri) * 0.2 - n01(carrier.a.str) * 0.08 - shield + (1 - carrier.bal) * 0.2;
    } else win = 0.62 + tck * 0.3;
    if (poke) win += 0.05;
    if (m.rng() < clamp(win, 0.05, 0.95)) {
      // won: a poke knocks it loose, a standing tackle takes it or blocks it away
      const keep = !poke && m.rng() < 0.45 + tck * 0.35;
      const ang = p.act.dir + (keep ? 0 : gauss(m.rng) * 0.9);
      const v = keep ? 1.8 + m.rng() * 1.5 : 3.5 + m.rng() * 4;
      b.vx = Math.cos(ang) * v + p.vx * 0.3; b.vy = Math.sin(ang) * v + p.vy * 0.3; b.vz = m.rng() < 0.2 ? 1.5 : 0;
      b.wx = -b.vy / BALL_R; b.wy = b.vx / BALL_R; b.wz = 0;
      b.ctrl = keep ? p : null; b.last = p; b.lastTeam = p.team; b.touchT = 0; b.flight = null; b.immune = p; b.immuneT = 0.15;
      if (keep) { p.drib.lastT = m.t; p.drib.since = 0; }
      p.touch = { t: m.t, foot: p.act.foot, kind: poke ? "poke" : "tackle", x: b.x, y: b.y };
      if (carrier) {
        hitBalance(m, carrier, 0.18 + n01(p.a.str) * 0.12, Math.atan2(carrier.y - p.y, carrier.x - p.x), "side");
        carrier.act = carrier.act && carrier.act.k === "skill" ? null : carrier.act; // a skill move is cut short
      }
      m.events.push({ type: "tackle", by: p.id, won: true, poke: !!poke, from: carrier ? carrier.id : -1 });
      m.stats.tackles[p.team]++;
      return;
    }
    // the carrier rides it: a touch past, the defender bumped
    m.events.push({ type: "tackle", by: p.id, won: false, poke: !!poke, from: carrier ? carrier.id : -1 });
    p.bal -= 0.15;
    return;
  }
  if (carrier && (legsHit || hyp(carrier.x - fx, carrier.y - fy) < 0.5)) {
    // caught the man
    const fromBehind = Math.abs(angDiff(carrier.face, Math.atan2(carrier.y - p.y, carrier.x - p.x))) < 1.0;
    const sev = clamp(0.12 + (fromBehind ? 0.28 : 0) + n01(p.a.agg) * 0.12 + hyp(p.vx, p.vy) * 0.025 - tck * 0.15 + m.rng() * 0.15, 0.05, 0.95);
    fallDown(m, carrier, Math.atan2(carrier.vy || Math.sin(carrier.face), carrier.vx || Math.cos(carrier.face)), fromBehind ? "forward" : "twist", sev);
    m.foul(p, carrier, poke ? "trip" : "tackle", sev);
    m.events.push({ type: "tackle", by: p.id, won: false, foul: true, from: carrier.id });
    return;
  }
  // nothing: committed and beaten
  p.bal -= 0.22;
  m.events.push({ type: "tackle", by: p.id, won: false, miss: true });
}

// ---------- slide tackle ----------
export function startSlide(m, p, dir) {
  if (!canPlay(p) || p.act || p.mode === "stumble") return false;
  const sp = Math.max(p.spd, 3.5);
  p.act = { k: "slide", own: true, t: 0, phase: "plant", dir, v: Math.min(10.5, sp * 1.12 + 1.2), T: 0, lock: 1, busy: true, turnK: 0.2, hitBall: false, hitMan: null, sx: p.x, sy: p.y, foot: p.prof.foot > 0 ? 0 : 1 };
  m.events.push({ type: "slide", by: p.id, x: p.x, y: p.y, dir });
  return true;
}

export function updateSlide(m, p, dt) {
  const A = p.act, b = m.ball;
  A.t += dt;
  if (A.phase === "plant") {
    // the last step and the drop: still steerable a little toward the ball
    const toBall = Math.atan2(b.y - p.y, b.x - p.x);
    if (Math.abs(angDiff(A.dir, toBall)) < 0.6) A.dir += angDiff(A.dir, toBall) * 0.5;
    p.vx = Math.cos(A.dir) * Math.max(p.spd, 3); p.vy = Math.sin(A.dir) * Math.max(p.spd, 3);
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.face = A.dir;
    if (A.t > 0.1) { A.phase = "slide"; A.t0 = A.t; p.vx = Math.cos(A.dir) * A.v; p.vy = Math.sin(A.dir) * A.v; }
    return;
  }
  if (A.phase === "slide") {
    // sliding on the grass: friction slows him, wet grass lets him go further
    const fr = (m.wet ? 5.2 : 7) * dt;
    const sp = hyp(p.vx, p.vy);
    const nsp = Math.max(0, sp - fr);
    p.vx *= sp > 0 ? nsp / sp : 0; p.vy *= sp > 0 ? nsp / sp : 0;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.spd = nsp;
    // the leading foot
    const reach = leg(p) * 1.45;
    const fx = p.x + Math.cos(A.dir) * reach, fy = p.y + Math.sin(A.dir) * reach;
    if (!A.hitBall && b.z < 0.55) {
      // ball along the leg: from the hip to the foot
      const t = clamp(((b.x - p.x) * Math.cos(A.dir) + (b.y - p.y) * Math.sin(A.dir)) / reach, 0, 1);
      const lx = p.x + Math.cos(A.dir) * reach * t, ly = p.y + Math.sin(A.dir) * reach * t;
      if (hyp(b.x - lx, b.y - ly) < 0.32 + BALL_R && t > 0.35) {
        A.hitBall = true;
        const carrier = b.ctrl && b.ctrl.team !== p.team ? b.ctrl : null;
        const ang = A.dir + gauss(m.rng) * 0.5 * (1.1 - n01(p.a.sld));
        const v = Math.max(3, nsp * (0.6 + m.rng() * 0.5));
        b.vx = Math.cos(ang) * v; b.vy = Math.sin(ang) * v; b.vz = m.rng() < 0.25 ? 2 + m.rng() * 2 : 0;
        b.ctrl = null; b.last = p; b.lastTeam = p.team; b.touchT = 0; b.flight = null; b.immune = p; b.immuneT = 0.2;
        p.touch = { t: m.t, foot: A.foot, kind: "slide", x: b.x, y: b.y };
        m.events.push({ type: "tackle", by: p.id, won: true, slide: true, from: carrier ? carrier.id : -1 });
        m.stats.tackles[p.team]++;
      }
    }
    // an opponent's legs in the way
    for (const o of m.teams[1 - p.team].players) {
      if (o.off || o === A.hitMan || o.mode === "down" || o.mode === "fall" || o.z > 0.4) continue;
      if (hyp(o.x - fx, o.y - fy) > 0.62 && hyp(o.x - (p.x + fx) / 2, o.y - (p.y + fy) / 2) > 0.55) continue;
      A.hitMan = o;
      const fromBehind = Math.abs(angDiff(o.face, A.dir)) < 0.9;
      const late = !A.hitBall;
      const hard = clamp(nsp * 0.045 + (fromBehind ? 0.22 : 0) + (late ? 0.15 : -0.1) + n01(p.a.agg) * 0.08 + m.rng() * 0.12, 0.1, 0.98);
      fallDown(m, o, A.dir + (m.rng() - 0.5) * 0.6, fromBehind ? "forward" : late ? "twist" : "knee", hard);
      if (late || (fromBehind && m.rng() < 0.55)) m.foul(p, o, "slide", hard);
      else m.events.push({ type: "clean_through", by: p.id, on: o.id });
      if (b.ctrl === o) b.ctrl = null;
    }
    if (nsp < 0.4) { A.phase = "ground"; A.t1 = A.t; m.events.push({ type: "slide_end", by: p.id, sx: A.sx, sy: A.sy, x: p.x, y: p.y }); }
    return;
  }
  if (A.phase === "ground") {
    p.vx = 0; p.vy = 0;
    // a well timed slide springs back up; a tired or clumsy one stays down longer
    const up = 0.55 + (1 - n01(p.a.agi)) * 0.35 + (1 - p.stam) * 0.25;
    if (A.t - A.t1 > up) { p.act = null; p.mode = "getup"; p.modeT = 0; p.getupT = 0.45 + (1 - n01(p.a.agi)) * 0.25; }
  }
}

// ---------- shoulder challenge: lean in on a man running alongside ----------
export function shoulder(m, p, o) {
  const d = hyp(o.x - p.x, o.y - p.y);
  if (d > 1.05) return false;
  const side = Math.abs(angDiff(p.face, Math.atan2(o.y - p.y, o.x - p.x)));
  if (side < 0.7 || side > 2.4) return false; // must be alongside, not behind or in front
  const behindHim = Math.abs(angDiff(o.face, Math.atan2(o.y - p.y, o.x - p.x))) < 0.6;
  const ux = (o.x - p.x) / d, uy = (o.y - p.y) / d;
  const mp = p.prof.mass * (0.75 + n01(p.a.str) * 0.5) * (0.6 + p.bal * 0.4), mo = o.prof.mass * (0.75 + n01(o.a.str) * 0.5) * (0.6 + o.bal * 0.4);
  const push = 1.4 * mp / (mp + mo);
  o.vx += ux * push; o.vy += uy * push;
  p.vx -= ux * push * mo / mp * 0.5; p.vy -= uy * push * mo / mp * 0.5;
  hitBalance(m, o, 0.22 * mp / mo * (1.25 - n01(o.a.bal) * 0.5), Math.atan2(uy, ux), "side");
  p.bal -= 0.1 * mo / mp;
  p.shoulderT = m.t;
  m.events.push({ type: "shoulder", by: p.id, on: o.id, won: mp > mo });
  if (behindHim && m.rng() < 0.6) m.foul(p, o, "push", 0.3);
  if (m.ball.ctrl === o && mp > mo * 1.05 && m.rng() < 0.55) m.ball.ctrl = null;
  return true;
}

// ---------- blocks and interceptions (automatic, for AI and the player you control) ----------
// a ball passing within reach of a defender who is set and watching it gets cut out, by the foot or the body
export function tryIntercept(m, p) {
  const b = m.ball;
  if (!canPlay(p) || b.ctrl || b.held) return false;
  if (b.last && b.last.team === p.team && b.touchT < 1.5) return false;
  if (b.immune === p && b.immuneT > 0) return false;
  const d = hyp(b.x - p.x, b.y - p.y);
  const reach = REACH * (1.1 + n01(p.a.rea) * 0.15) + (p.act && p.act.k === "block" ? 0.25 : 0);
  if (d > reach || b.z > (p.gk ? 2.3 : 1.25)) return false;
  const bsp = hyp(b.vx, b.vy, b.vz);
  // reading it in time: awareness and reactions against ball speed
  const read = n01(p.a.awa) * 0.5 + n01(p.a.rea) * 0.5;
  const chance = clamp(0.92 - Math.max(0, bsp - 10) * 0.035 + read * 0.15 - (d > REACH ? 0.25 : 0) - (b.z > 0.5 ? 0.15 : 0), 0.05, 0.97);
  if (m.rng() > chance * (p.ai && p.ai.cutPenalty ? 0.5 : 1)) { p.ai && (p.ai.cutPenalty = m.t); return false; }
  return true;
}
